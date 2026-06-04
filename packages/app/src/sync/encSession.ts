/* Sessie-sleutelbeheer voor de zero-knowledge sync.
 *
 * Houdt de ontgrendelde DEK in het geheugen (alleen zolang de pagina open is) en
 * regelt de ontgrendelmethoden: passphrase, herstelcode en biometrie (WebAuthn-PRF).
 *
 * Opslag (db.meta):
 *  - "enc"          → { enabled: true, slots: { passphrase, recovery? } }
 *                     De sloten zijn gewrapte DEK's (niet geheim); lokaal gecachet
 *                     zodat een push ze kan meeschrijven zonder de cloud te lezen.
 *  - "encDeviceKey" → { credentialId, prfSalt, wrapIv, wrappedDek }
 *                     Apparaat-gebonden biometrie-slot; staat NOOIT in de cloud.
 *
 * De rauwe DEK-bytes blijven in het geheugen zolang ontgrendeld (nodig om nieuwe
 * sloten te wrappen, bv. biometrie inschakelen of passphrase wijzigen). De DEK
 * wordt daarnaast als non-extractable CryptoKey gebruikt voor de snapshot-en/decrypt. */

import { useSyncExternalStore } from "react";
import { keepGet, keepPut, keepDelete } from "../db/keep";
import {
  generateDekRaw, importDek, makeSlot, openSlot, encryptSnapshot, decryptSnapshot,
  importWrapKey, wrapDek, unwrapDek, bytesToB64, b64ToBytes,
  type KeySlot, type EncBody, type EncEnvelope,
} from "./crypto";

interface EncMeta {
  enabled: true;
  slots: { passphrase: KeySlot; recovery?: KeySlot };
}
interface DeviceSlot {
  credentialId: string; // base64
  prfSalt: string; // base64
  wrapIv: string; // base64
  wrappedDek: string; // base64
}

type Bytes = Uint8Array<ArrayBuffer>;

/* ── Sessiestatus (in geheugen) ── */
let dekKey: CryptoKey | null = null; // non-extractable, voor snapshot-crypto
let dekRaw: Bytes | null = null; // ruw, voor het maken van nieuwe sloten
let cachedSlots: EncMeta["slots"] | null = null;
const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }
export function subscribeEnc(cb: () => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }

/* React-hook: is de sessie ontgrendeld? Reactief op (ont)grendelen. */
export function useEncUnlocked(): boolean {
  return useSyncExternalStore(subscribeEnc, isUnlocked, () => false);
}

async function setSession(raw: Bytes) {
  dekRaw = raw;
  dekKey = await importDek(raw);
  emit();
}

export function isUnlocked(): boolean { return !!dekKey; }

export function lock(): void {
  if (dekRaw) dekRaw.fill(0);
  dekRaw = null;
  dekKey = null;
  emit();
}

/* ── Status uit meta ── */
export async function getEncMeta(): Promise<EncMeta | null> {
  return (await keepGet<EncMeta>("enc")) ?? null;
}
export async function isEncryptionEnabled(): Promise<boolean> {
  return !!(await getEncMeta())?.enabled;
}
async function getDeviceSlot(): Promise<DeviceSlot | null> {
  return (await keepGet<DeviceSlot>("encDeviceKey")) ?? null;
}
export async function hasBiometricSlot(): Promise<boolean> {
  return !!(await getDeviceSlot());
}

/* ── Setup: encryptie aanzetten ── */
/* Genereert een DEK, maakt een passphrase- en herstelcode-slot, ontgrendelt de
 * sessie en retourneert de éénmalig te tonen herstelcode. De aanroeper moet
 * hierna pushen (pushToOneDrive schrijft dan de versleutelde envelope). */
export async function setupEncryption(passphrase: string): Promise<{ recoveryCode: string }> {
  const raw = generateDekRaw();
  const recoveryCode = generateRecoveryCode();
  const slots: EncMeta["slots"] = {
    passphrase: await makeSlot(raw, passphrase),
    recovery: await makeSlot(raw, recoveryCode),
  };
  cachedSlots = slots;
  await keepPut("enc", { enabled: true, slots } satisfies EncMeta);
  await setSession(raw);
  return { recoveryCode };
}

/* ── Ontgrendelen ── */
/* Ontgrendel met passphrase. `cloudSlots` (uit een gedownloade envelope) heeft
 * voorrang op de lokale cache — zo werkt een vers toestel dat nog geen lokale
 * sloten heeft. Bij succes worden de sloten lokaal gecachet. */
export async function unlockWithPassphrase(passphrase: string, cloudSlots?: EncEnvelope["slots"]): Promise<void> {
  const slots = cloudSlots ?? cachedSlots ?? (await getEncMeta())?.slots;
  if (!slots) throw new Error("Geen versleuteling ingesteld.");
  const raw = await openSlot(slots.passphrase, passphrase); // gooit bij verkeerde passphrase
  await persistSlots(slots);
  await setSession(raw);
}

export async function unlockWithRecovery(code: string, cloudSlots?: EncEnvelope["slots"]): Promise<void> {
  const slots = cloudSlots ?? cachedSlots ?? (await getEncMeta())?.slots;
  if (!slots?.recovery) throw new Error("Geen herstelcode-slot beschikbaar.");
  const raw = await openSlot(slots.recovery, normalizeRecoveryCode(code));
  await persistSlots(slots);
  await setSession(raw);
}

async function persistSlots(slots: EncMeta["slots"]) {
  cachedSlots = slots;
  await keepPut("enc", { enabled: true, slots } satisfies EncMeta);
}

/* ── Verzegelen / openen van een snapshot voor de sync-laag ── */
export async function sealSnapshot(snap: unknown): Promise<EncEnvelope> {
  if (!dekKey) throw new Error("locked");
  const slots = cachedSlots ?? (await getEncMeta())?.slots;
  if (!slots) throw new Error("Geen versleuteling ingesteld.");
  const body: EncBody = await encryptSnapshot(snap, dekKey);
  return { ...body, slots };
}

export async function openEnvelope(env: EncEnvelope): Promise<unknown> {
  if (!dekKey) throw new Error("locked");
  return decryptSnapshot(env, dekKey);
}

/* Sloten uit een gedownloade cloud-envelope lokaal bijwerken (bv. als een ander
 * toestel de passphrase heeft gewijzigd). */
export async function adoptCloudSlots(slots: EncEnvelope["slots"]): Promise<void> {
  await persistSlots(slots);
}

/* Ontsleutel een versleuteld back-upbestand met de passphrase, los van de sessie
 * (gebruikt de sloten uit het bestand zelf). Voor import van een encrypted export. */
export async function decryptFileWithPassphrase(env: EncEnvelope, passphrase: string): Promise<unknown> {
  const raw = await openSlot(env.slots.passphrase, passphrase);
  return decryptSnapshot(env, await importDek(raw));
}

/* ── Passphrase wijzigen (vereist ontgrendelde sessie) ── */
export async function changePassphrase(newPassphrase: string): Promise<void> {
  if (!dekRaw) throw new Error("locked");
  const slots = cachedSlots ?? (await getEncMeta())?.slots;
  if (!slots) throw new Error("Geen versleuteling ingesteld.");
  const updated: EncMeta["slots"] = { ...slots, passphrase: await makeSlot(dekRaw, newPassphrase) };
  await persistSlots(updated);
}

/* ════════════════════════ Biometrie (WebAuthn-PRF) ════════════════════════ */

/* Minimale PRF-types: lib.dom kent de prf-extensie (nog) niet volledig. */
type PrfInputs = { prf?: { eval?: { first: BufferSource } } };
type PrfOutputs = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

function prfOutputs(cred: PublicKeyCredential): PrfOutputs {
  return cred.getClientExtensionResults() as PrfOutputs;
}

/* Biometrie inschakelen op dit toestel (vereist ontgrendelde sessie).
 * Registreert een platform-passkey met de prf-extensie, haalt via een directe
 * get() het PRF-geheim op, en wrapt daarmee de DEK in een lokaal apparaat-slot. */
export async function enableBiometric(): Promise<void> {
  if (!dekRaw) throw new Error("locked");
  if (!(await isPlatformAuthenticatorAvailable())) throw new Error("Geen biometrie/passkey beschikbaar op dit toestel.");

  const userId = crypto.getRandomValues(new Uint8Array(16));
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "bokkiep" },
      user: { id: userId, name: "bokkiep", displayName: "bokkiep" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs & PrfInputs,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error("Biometrie-registratie afgebroken.");

  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const secret = await evalPrf(created.rawId, prfSalt);
  const kek = await importWrapKey(secret);
  const { wrapIv, wrappedDek } = await wrapDek(dekRaw, kek);
  const slot: DeviceSlot = {
    credentialId: bytesToB64(new Uint8Array(created.rawId)),
    prfSalt: bytesToB64(prfSalt),
    wrapIv, wrappedDek,
  };
  await keepPut("encDeviceKey", slot);
  emit();
}

export async function unlockWithBiometric(): Promise<void> {
  const slot = await getDeviceSlot();
  if (!slot) throw new Error("Biometrie niet ingeschakeld op dit toestel.");
  const secret = await evalPrf(b64ToBytes(slot.credentialId).buffer, b64ToBytes(slot.prfSalt));
  const kek = await importWrapKey(secret);
  const raw = await unwrapDek(slot.wrappedDek, slot.wrapIv, kek);
  await setSession(raw);
}

export async function disableBiometric(): Promise<void> {
  await keepDelete("encDeviceKey");
  emit();
}

/* Doe een WebAuthn-get met prf-eval en geef het 32-byte PRF-geheim terug. */
async function evalPrf(credentialId: ArrayBuffer, salt: Bytes): Promise<Bytes> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId, type: "public-key" }],
      userVerification: "required",
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs & PrfInputs,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("Biometrie afgebroken.");
  const out = prfOutputs(assertion).prf?.results?.first;
  if (!out) throw new Error("Dit toestel/browser ondersteunt geen PRF — gebruik je wachtwoord.");
  return new Uint8Array(out);
}

/* ── helpers ── */
/* Leesbare herstelcode: 24 base32-tekens in groepjes van 4 (bv. ABCD-EFGH-...). */
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // zonder verwarrende I/L/O/0/1
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 4 === 0) s += "-";
    s += alphabet[bytes[i] % alphabet.length];
  }
  return s;
}
function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(?=.)/g, "$1-");
}
