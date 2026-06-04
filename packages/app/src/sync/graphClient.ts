/* Minimale Microsoft Graph-client voor het lezen/schrijven van één databestand
 * in de App Folder van de gebruiker (/me/drive/special/approot/data.json), plus
 * getimestampte backup-kopieën in approot/backups/. */
const GRAPH = "https://graph.microsoft.com/v1.0";
const FILE = "data.json";
const ITEM = `${GRAPH}/me/drive/special/approot:/${FILE}`;
const BACKUP_DIR = `${GRAPH}/me/drive/special/approot:/backups`;

/* Gegooid wanneer een upload met If-Match faalt (412): de cloud is sinds onze
 * laatste lezing door een ander toestel gewijzigd. De sync-laag vertaalt dit naar
 * een conflict i.p.v. blind te overschrijven. */
export class RemoteChangedError extends Error {
  constructor() {
    super("De OneDrive-versie is sinds je laatste sync gewijzigd (ander apparaat). Om geen data te overschrijven is er niets weggeschreven — synchroniseer opnieuw.");
    this.name = "RemoteChangedError";
  }
}

export interface RemoteMeta {
  id: string;
  eTag: string;
  lastModified: string; // ISO
  size: number;
}

export async function getRemoteMeta(token: string): Promise<RemoteMeta | null> {
  const res = await fetch(ITEM, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Graph metadata-fout: ${res.status}`);
  const j = await res.json();
  return { id: j.id, eTag: j.eTag, lastModified: j.lastModifiedDateTime, size: j.size };
}

export async function downloadData(token: string): Promise<unknown | null> {
  const res = await fetch(`${ITEM}:/content`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Graph download-fout: ${res.status}`);
  return res.json();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Kon de foto niet lezen."));
    r.readAsDataURL(blob);
  });
}

/* Profielfoto van de ingelogde gebruiker (vereist de User.Read-scope, die al is toegekend).
 * Retourneert een data-URL, of null als er geen foto is ingesteld (404). */
export async function downloadProfilePhoto(token: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/me/photo/$value`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Graph foto-fout: ${res.status}`);
  return blobToDataUrl(await res.blob());
}

/* Upload de dataset naar data.json. Met `ifMatch` (de eTag uit de laatste lezing)
 * wordt de schrijfactie alleen uitgevoerd als de cloud sindsdien niet is gewijzigd;
 * een 412 wordt vertaald naar RemoteChangedError (optimistic concurrency). */
export async function uploadData(token: string, data: unknown, ifMatch?: string): Promise<RemoteMeta> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (ifMatch) headers["If-Match"] = ifMatch;
  const res = await fetch(`${ITEM}:/content`, { method: "PUT", headers, body: JSON.stringify(data) });
  if (res.status === 412) throw new RemoteChangedError();
  if (!res.ok) throw new Error(`Graph upload-fout: ${res.status}`);
  const j = await res.json();
  return { id: j.id, eTag: j.eTag, lastModified: j.lastModifiedDateTime, size: j.size };
}

/* ── Backups (approot/backups/data-<ISO>.json) ── */

export interface BackupItem {
  name: string;
  lastModified: string; // ISO
  size: number;
}

/* Kopieer de huidige data.json naar een getimestampte backup vóór een overwrite.
 * Bewaart de exacte bytes (ook een versleutelde envelope blijft zo zero-knowledge).
 * Geen bestaand databestand (404) → niets te backuppen. Gooit bij andere fouten,
 * zodat een mislukte backup de overwrite tegenhoudt (fail closed). */
export async function backupRemote(token: string): Promise<void> {
  const res = await fetch(`${ITEM}:/content`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Graph backup-leesfout: ${res.status}`);
  const body = await res.text();
  const name = `data-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const put = await fetch(`${BACKUP_DIR}/${name}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
  });
  if (!put.ok) throw new Error(`Graph backup-schrijffout: ${put.status}`);
  await pruneBackups(token);
}

/* Backups, nieuwste eerst (ISO-namen sorteren chronologisch). */
export async function listBackups(token: string): Promise<BackupItem[]> {
  const res = await fetch(`${BACKUP_DIR}:/children?$select=name,lastModifiedDateTime,size`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Graph backup-lijstfout: ${res.status}`);
  const j = await res.json();
  const items: BackupItem[] = (j.value ?? [])
    .filter((f: { name?: string }) => typeof f.name === "string" && f.name.endsWith(".json"))
    .map((f: { name: string; lastModifiedDateTime: string; size: number }) => ({
      name: f.name, lastModified: f.lastModifiedDateTime, size: f.size,
    }));
  return items.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

export async function downloadBackup(token: string, name: string): Promise<unknown | null> {
  const res = await fetch(`${BACKUP_DIR}/${name}:/content`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Graph backup-download-fout: ${res.status}`);
  return res.json();
}

/* Houd alleen de nieuwste `keep` backups; verwijder de rest. */
export async function pruneBackups(token: string, keep = 10): Promise<void> {
  const items = await listBackups(token);
  for (const old of items.slice(keep)) {
    await fetch(`${BACKUP_DIR}/${old.name}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  }
}
