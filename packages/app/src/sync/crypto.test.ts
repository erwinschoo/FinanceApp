import { describe, it, expect } from "vitest";
import {
  generateDekRaw, importDek, makeSlot, openSlot, encryptSnapshot, decryptSnapshot,
  isEncEnvelope, bytesToB64, b64ToBytes, ENC_MAGIC, type EncEnvelope,
} from "./crypto";

const sample = {
  schemaVersion: 1,
  exportedAt: "2026-06-01T00:00:00.000Z",
  transactions: [{ id: "t1", amountCents: -1234, counterIban: "NL00BANK0123456789", merchant: "Albert Heijn" }],
  categories: [{ id: "boodschappen" }],
};

describe("base64 round-trip", () => {
  it("herstelt willekeurige bytes exact", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(40));
    expect([...b64ToBytes(bytesToB64(bytes))]).toEqual([...bytes]);
  });
});

describe("snapshot en/decrypt", () => {
  it("round-trip met dezelfde DEK levert de originele data op", async () => {
    const raw = generateDekRaw();
    const dek = await importDek(raw);
    const env = await encryptSnapshot(sample, dek);
    expect(env.bokkiep).toBe(ENC_MAGIC);
    expect(JSON.stringify(env)).not.toContain("Albert Heijn"); // niet leesbaar in ciphertext
    const out = await decryptSnapshot(env, dek);
    expect(out).toEqual(sample);
  });

  it("ontsleutelen met een andere DEK faalt", async () => {
    const dek = await importDek(generateDekRaw());
    const env = await encryptSnapshot(sample, dek);
    const wrong = await importDek(generateDekRaw());
    await expect(decryptSnapshot(env, wrong)).rejects.toThrow();
  });
});

describe("ontgrendel-sloten (KEK wrapt DEK)", () => {
  it("opent met de juiste passphrase en geeft dezelfde DEK", async () => {
    const raw = generateDekRaw();
    const slot = await makeSlot(raw, "correct horse battery");
    expect([...(await openSlot(slot, "correct horse battery"))]).toEqual([...raw]);
  });

  it("faalt met een verkeerde passphrase", async () => {
    const slot = await makeSlot(generateDekRaw(), "geheim-wachtwoord");
    await expect(openSlot(slot, "fout-wachtwoord")).rejects.toThrow();
  });
});

describe("volledige envelope (zoals in OneDrive)", () => {
  it("passphrase → DEK → ontsleutelt de snapshot", async () => {
    const raw = generateDekRaw();
    const env: EncEnvelope = { ...(await encryptSnapshot(sample, await importDek(raw))), slots: { passphrase: await makeSlot(raw, "pw123456") } };
    // simuleer een vers toestel: alleen de envelope + de passphrase
    const recovered = await openSlot(env.slots.passphrase, "pw123456");
    const out = await decryptSnapshot(env, await importDek(recovered));
    expect(out).toEqual(sample);
  });
});

describe("envelope-detectie", () => {
  it("herkent een envelope en negeert platte snapshots", () => {
    expect(isEncEnvelope({ bokkiep: ENC_MAGIC, iv: "", ct: "", zip: false, slots: {} })).toBe(true);
    expect(isEncEnvelope(sample)).toBe(false);
    expect(isEncEnvelope(null)).toBe(false);
  });
});
