/* Zero-knowledge encryptie voor de OneDrive-sync.
 *
 * Envelope-patroon: één willekeurige Data Encryption Key (DEK) versleutelt de
 * snapshot; de DEK wordt los "gewrapt" (AES-GCM-versleuteld) door één of meer
 * Key Encryption Keys (KEK) — afgeleid van een passphrase, herstelcode of
 * WebAuthn-PRF-geheim. Microsoft ziet alleen de envelope (ciphertext + sloten),
 * nooit leesbare data of een sleutel.
 *
 * Alle functies hier zijn puur (alleen WebCrypto) en kennen geen MSAL/Graph/UI,
 * zodat ze los te unit-testen zijn. De DEK wordt als NON-EXTRACTABLE CryptoKey
 * geïmporteerd: bruikbaar voor en/decrypt, maar de rauwe bytes zijn daarna niet
 * meer uit te lezen (beperkt de schade van een XSS terwijl de pagina open is). */

export const ENC_MAGIC = "enc-v1";
const PBKDF2_ITER = 600_000;
const SALT_LEN = 16; // bytes
const IV_LEN = 12; // bytes (AES-GCM aanbeveling)
const DEK_LEN = 32; // bytes (AES-256)

/* ── KDF-parameters zoals opgeslagen in de envelope ── */
export interface KdfParams {
  alg: "PBKDF2";
  hash: "SHA-256";
  iter: number;
  salt: string; // base64
}

/* Eén ontgrendel-slot: een DEK gewrapt door een uit een geheim afgeleide KEK. */
export interface KeySlot {
  kdf: KdfParams;
  wrapIv: string; // base64
  wrappedDek: string; // base64
}

/* De versleutelde snapshot zelf (zonder ontgrendel-sloten). */
export interface EncBody {
  bokkiep: typeof ENC_MAGIC;
  zip: boolean; // is de plaintext met gzip gecomprimeerd vóór encryptie?
  iv: string; // base64 — IV van de snapshot-encryptie
  ct: string; // base64 — AES-256-GCM(snapshot)
}

/* De volledige envelope zoals die in OneDrive (data.json) staat: de body plus de
 * ontgrendel-sloten. Sloten zijn niet geheim (het zijn gewrapte DEK's) en mogen
 * dus ook lokaal worden gecachet. */
export interface EncEnvelope extends EncBody {
  slots: { passphrase: KeySlot; recovery?: KeySlot };
}

/* WebCrypto verwacht ArrayBuffer-backed views (niet SharedArrayBuffer), dus we
 * typeren onze bytes expliciet zo — anders defaulten ze naar ArrayBufferLike. */
type Bytes = Uint8Array<ArrayBuffer>;

/* ── base64 <-> bytes ── */
export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function b64ToBytes(b64: string): Bytes {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(n));
}

/* ── DEK ── */
export function generateDekRaw(): Bytes {
  return randomBytes(DEK_LEN);
}

/* Importeer rauwe DEK-bytes als NON-EXTRACTABLE sleutel voor snapshot-en/decrypt. */
export async function importDek(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/* ── KEK: leid een wrap-sleutel af uit een geheim (passphrase/herstelcode) ── */
export function newKdfParams(): KdfParams {
  return { alg: "PBKDF2", hash: "SHA-256", iter: PBKDF2_ITER, salt: bytesToB64(randomBytes(SALT_LEN)) };
}

export async function deriveKek(secret: string, kdf: KdfParams): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBytes(kdf.salt), iterations: kdf.iter, hash: kdf.hash },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* Importeer 32 ruwe bytes (bv. een WebAuthn-PRF-geheim) als AES-GCM wrap-sleutel. */
export async function importWrapKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/* ── Wrap/unwrap van de rauwe DEK met een KEK (AES-GCM over de 32 bytes) ── */
export async function wrapDek(rawDek: Bytes, kek: CryptoKey): Promise<{ wrapIv: string; wrappedDek: string }> {
  const iv = randomBytes(IV_LEN);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, rawDek);
  return { wrapIv: bytesToB64(iv), wrappedDek: bytesToB64(new Uint8Array(ct)) };
}

export async function unwrapDek(wrappedDek: string, wrapIv: string, kek: CryptoKey): Promise<Bytes> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(wrapIv) }, kek, b64ToBytes(wrappedDek));
  return new Uint8Array(pt);
}

/* Bouw een ontgrendel-slot voor een gegeven geheim (genereert verse KDF-salt). */
export async function makeSlot(rawDek: Bytes, secret: string): Promise<KeySlot> {
  const kdf = newKdfParams();
  const kek = await deriveKek(secret, kdf);
  const { wrapIv, wrappedDek } = await wrapDek(rawDek, kek);
  return { kdf, wrapIv, wrappedDek };
}

/* Open een slot met een geheim → rauwe DEK-bytes. Gooit bij verkeerd geheim
 * (AES-GCM-authenticatie faalt → OperationError). */
export async function openSlot(slot: KeySlot, secret: string): Promise<Bytes> {
  const kek = await deriveKek(secret, slot.kdf);
  return unwrapDek(slot.wrappedDek, slot.wrapIv, kek);
}

/* ── gzip (optioneel; feature-detect zodat oude browsers gewoon plain doen) ── */
function canGzip(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}
async function gzip(bytes: Bytes): Promise<Bytes> {
  const cs = new CompressionStream("gzip");
  const stream = new Response(bytes).body!.pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Bytes): Promise<Bytes> {
  const ds = new DecompressionStream("gzip");
  const stream = new Response(bytes).body!.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ── Snapshot en/decrypt met een DEK-CryptoKey ── */
/* Versleutel de data tot een body; de aanroeper (encSession) plakt er de
 * ontgrendel-sloten bij tot een volledige EncEnvelope. */
export async function encryptSnapshot(data: unknown, dek: CryptoKey): Promise<EncBody> {
  const json: Bytes = new TextEncoder().encode(JSON.stringify(data));
  const zip = canGzip();
  const plain = zip ? await gzip(json) : json;
  const iv = randomBytes(IV_LEN);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dek, plain);
  return { bokkiep: ENC_MAGIC, zip, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptSnapshot(env: EncBody, dek: CryptoKey): Promise<unknown> {
  const ptBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(env.iv) }, dek, b64ToBytes(env.ct));
  const bytes: Bytes = new Uint8Array(ptBytes);
  const json = env.zip ? await gunzip(bytes) : bytes;
  return JSON.parse(new TextDecoder().decode(json));
}

/* Herken een versleutelde envelope (vs. een legacy plaintext-snapshot). */
export function isEncEnvelope(obj: unknown): obj is EncEnvelope {
  return !!obj && typeof obj === "object" && (obj as { bokkiep?: unknown }).bokkiep === ENC_MAGIC;
}
