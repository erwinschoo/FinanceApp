import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

/* "Keep"-store: een aparte, ALTIJD-persistente Dexie-db die nooit financiële
 * plaintext bevat. Hierin staan de bootstrap-/sync-/account-meta én — wanneer
 * at-rest-versleuteling aanstaat — de versleutelde vault (ciphertext snapshot).
 *
 * Reden voor een aparte db: de hoofd-db (FinanceDB "bokkiep") draait in-memory
 * zodra versleuteling aanstaat, zodat plaintext nooit op schijf komt. De keep-store
 * blijft dan de enige persistente laag (en bevat alleen ciphertext + niet-gevoelige
 * meta zoals e-mail/sync-eTag/gewrapte sleutel-slots). */

interface KvRow { key: string; value: unknown }

class KeepDB extends Dexie {
  kv!: Table<KvRow, string>;
  constructor() {
    super("bokkiep-keep");
    this.version(1).stores({ kv: "key" });
  }
}

export const keep = new KeepDB();

/* ── Generieke key/value ── */
export async function keepGet<T = unknown>(key: string): Promise<T | undefined> {
  return (await keep.kv.get(key))?.value as T | undefined;
}
export async function keepPut(key: string, value: unknown): Promise<void> {
  await keep.kv.put({ key, value });
}
export async function keepDelete(key: string): Promise<void> {
  await keep.kv.delete(key);
}
/* Live-query op één keep-key (geeft de waarde direct terug, of undefined). */
export function useKeepMeta<T = unknown>(key: string): T | undefined {
  return useLiveQuery(() => keepGet<T>(key), [key], undefined);
}

/* ── encEnabled-vlag (keep autoritatief, localStorage als synchrone boot-hint) ── */
const ENC_ENABLED = "encEnabled";
const LS_FLAG = "bokkiep_enc";

/* Synchroon leesbaar bij boot, vóór enige async IndexedDB-call (voorkomt een flash
 * en bepaalt welke db-backend we openen). Keep blijft de bron van waarheid. */
export function getEncEnabledHint(): boolean {
  try { return localStorage.getItem(LS_FLAG) === "1"; } catch { return false; }
}
export async function getEncEnabled(): Promise<boolean> {
  const v = await keepGet<boolean>(ENC_ENABLED);
  if (v === true) { try { localStorage.setItem(LS_FLAG, "1"); } catch { /* ignore */ } return true; }
  if (v === false) { try { localStorage.removeItem(LS_FLAG); } catch { /* ignore */ } return false; }
  return getEncEnabledHint(); // keep nog niet gezet → val terug op de hint
}
export async function setEncEnabled(on: boolean): Promise<void> {
  await keepPut(ENC_ENABLED, on);
  try { if (on) localStorage.setItem(LS_FLAG, "1"); else localStorage.removeItem(LS_FLAG); } catch { /* ignore */ }
}

/* ── Versleutelde vault (ring van 3) ── */
const VAULT = "vault";
const VAULT_PREV = "vault_prev";
const VAULT_PREV2 = "vault_prev2";
const VAULT_PENDING = "vault_pending";

/* Torn-write-veilig: schrijf eerst naar een pending-key, promoot daarna in één
 * transactie (oud → prev → prev2). Een crash tussendoor laat de vorige vault intact. */
export async function writeVaultAtomic(env: unknown): Promise<void> {
  await keep.kv.put({ key: VAULT_PENDING, value: env });
  await keep.transaction("rw", keep.kv, async () => {
    const cur = await keep.kv.get(VAULT);
    const prev = await keep.kv.get(VAULT_PREV);
    if (prev) await keep.kv.put({ key: VAULT_PREV2, value: prev.value });
    if (cur) await keep.kv.put({ key: VAULT_PREV, value: cur.value });
    const pending = await keep.kv.get(VAULT_PENDING);
    if (pending) await keep.kv.put({ key: VAULT, value: pending.value });
    await keep.kv.delete(VAULT_PENDING);
  });
}

/* De vault-versies, nieuwste eerst — voor hydrate-met-fallback. */
export async function readVaultChain(): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const k of [VAULT, VAULT_PREV, VAULT_PREV2]) {
    const v = await keepGet(k);
    if (v != null) out.push(v);
  }
  return out;
}

export async function hasVault(): Promise<boolean> {
  return (await keepGet(VAULT)) != null;
}

export async function clearVault(): Promise<void> {
  await Promise.all([VAULT, VAULT_PREV, VAULT_PREV2, VAULT_PENDING].map((k) => keepDelete(k)));
}
