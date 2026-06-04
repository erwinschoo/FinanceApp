import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { RemoteMeta } from "./graphClient";

/* De externe afhankelijkheden mocken zodat we de beslislogica + de echte (fake)
 * IndexedDB isoleren. De cloud wordt een in-memory toestand die de mocks delen. */
const remote: { meta: RemoteMeta | null; content: unknown } = { meta: null, content: null };
const uploaded: { data: unknown; ifMatch?: string }[] = [];
const backupCalls: number[] = [];

vi.mock("./msal", () => ({
  getToken: vi.fn(async () => "tok"),
  getTokenSilent: vi.fn(async () => "tok"),
}));

vi.mock("./graphClient", () => {
  class RemoteChangedError extends Error {}
  return {
    RemoteChangedError,
    getRemoteMeta: vi.fn(async () => remote.meta),
    downloadData: vi.fn(async () => remote.content),
    downloadProfilePhoto: vi.fn(async () => null),
    listBackups: vi.fn(async () => []),
    downloadBackup: vi.fn(async () => null),
    backupRemote: vi.fn(async () => { if (remote.content != null) backupCalls.push(Date.now()); }),
    uploadData: vi.fn(async (_t: string, data: unknown, ifMatch?: string) => {
      uploaded.push({ data, ifMatch });
      remote.content = data;
      remote.meta = { id: "1", eTag: `etag-${uploaded.length}`, lastModified: new Date().toISOString(), size: 1 };
      return remote.meta;
    }),
  };
});

// Geen encryptie in deze tests → buildPayload/readRemote werken met platte snapshots.
vi.mock("./encSession", () => ({
  isEncryptionEnabled: vi.fn(async () => false),
  isUnlocked: vi.fn(() => true),
  sealSnapshot: vi.fn(async (s: unknown) => s),
  openEnvelope: vi.fn(async (e: unknown) => e),
  adoptCloudSlots: vi.fn(async () => {}),
}));

import { db } from "../db/schema";
import { seedIfEmpty } from "../db/seed";
import { hasUserContent } from "../db/userContent";
import {
  syncNow, isSubstantialTxLoss, snapshotTxCount, applyPull, listLocalBackups,
  getSyncMeta, type Snapshot,
} from "./syncEngine";

function snapshot(txCount: number): Snapshot {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    categories: [], categoryGroups: [], budgets: [], rules: [], goals: [],
    importBatches: [], importProfiles: [], pots: [], payees: [], profile: null,
    transactions: Array.from({ length: txCount }, (_, i) => ({
      id: `t${i}`, date: "2026-01-01", merchant: "X", rawDescription: "", category: "",
      amountCents: -100, auto: false, note: "", counterIban: "", accountIban: "",
      importBatchId: "b", dedupeHash: `h${i}`,
    })),
  };
}

async function addLocalTx(id = "local1"): Promise<void> {
  await db.transactions.put({
    id, date: "2026-02-01", merchant: "Lokaal", rawDescription: "", category: "",
    amountCents: -500, auto: false, note: "", counterIban: "", accountIban: "",
    importBatchId: "b", dedupeHash: id,
  });
}

const TABLES = [
  db.categories, db.categoryGroups, db.transactions, db.budgets, db.rules, db.goals,
  db.importBatches, db.importProfiles, db.pots, db.payees, db.meta,
];

beforeEach(async () => {
  await Promise.all(TABLES.map((t) => t.clear()));
  remote.meta = null; remote.content = null;
  uploaded.length = 0; backupCalls.length = 0;
  vi.clearAllMocks();
});

describe("isSubstantialTxLoss", () => {
  it("0 → niets te verliezen, ongeacht richting", () => {
    expect(isSubstantialTxLoss(0, 100)).toBe(false);
  });
  it("alles wissen (have>0, would=0) telt als verlies", () => {
    expect(isSubstantialTxLoss(100, 0)).toBe(true);
  });
  it("klein multi-device-verschil triggert niet", () => {
    expect(isSubstantialTxLoss(100, 95)).toBe(false);
  });
  it(">10 én ≥10% minder triggert wel", () => {
    expect(isSubstantialTxLoss(100, 80)).toBe(true);
  });
  it("snapshotTxCount telt transacties", () => {
    expect(snapshotTxCount(snapshot(3))).toBe(3);
  });
});

describe("hasUserContent", () => {
  it("is false voor een vers, geseeded toestel", async () => {
    await seedIfEmpty();
    expect(await hasUserContent()).toBe(false);
  });
  it("is true zodra er een transactie is", async () => {
    await seedIfEmpty();
    await addLocalTx();
    expect(await hasUserContent()).toBe(true);
  });
  it("is true bij een gezet profiel", async () => {
    await seedIfEmpty();
    await db.meta.put({ key: "profile", value: { adults: 1 } });
    expect(await hasUserContent()).toBe(true);
  });
});

describe("syncNow — air-tight beslissingen", () => {
  it("vers toestel + gevulde cloud → PULL, nooit push", async () => {
    await seedIfEmpty(); // seed-only, 0 transacties, geen baseline
    remote.content = snapshot(50);
    remote.meta = { id: "1", eTag: "r1", lastModified: new Date().toISOString(), size: 1 };

    const r = await syncNow();

    expect(r.action).toBe("pulled");
    expect(uploaded).toHaveLength(0);                 // er is NIETS geüpload
    expect(await db.transactions.count()).toBe(50);   // cloud-data overgenomen
  });

  it("vers/leeg toestel + geen cloudbestand → noop (geen lege upload)", async () => {
    await seedIfEmpty();
    remote.meta = null;

    const r = await syncNow();

    expect(r.action).toBe("noop");
    expect(uploaded).toHaveLength(0);
  });

  it("toestel met eigen data + gevulde cloud zonder baseline → conflict (bewust kiezen)", async () => {
    await seedIfEmpty();
    await addLocalTx();
    remote.content = snapshot(50);
    remote.meta = { id: "1", eTag: "r1", lastModified: new Date().toISOString(), size: 1 };

    const r = await syncNow();

    expect(r.action).toBe("conflict");
    expect(uploaded).toHaveLength(0);                 // niets overschreven
    expect(await db.transactions.count()).toBe(1);    // lokaal ongemoeid
  });

  it("eigen data + geen cloudbestand → eerste upload", async () => {
    await seedIfEmpty();
    await addLocalTx();
    remote.meta = null;

    const r = await syncNow();

    expect(r.action).toBe("pushed");
    expect(uploaded).toHaveLength(1);
  });
});

describe("applyPull maakt een lokale momentopname vóór de import", () => {
  it("bewaart de huidige staat als terugzetbare back-up", async () => {
    await seedIfEmpty();
    await addLocalTx("voor-pull");

    await applyPull(snapshot(10), "etag-x");

    const backups = await listLocalBackups();
    expect(backups.length).toBeGreaterThanOrEqual(1);
    expect(backups[0].txCount).toBe(1);               // de staat van vóór de pull
    expect(await db.transactions.count()).toBe(10);   // na de pull de cloud-data
    expect((await getSyncMeta())?.remoteEtag).toBe("etag-x");
  });
});
