/* Minimale Microsoft Graph-client voor het lezen/schrijven van één databestand
 * in de App Folder van de gebruiker (/me/drive/special/approot/data.json). */
const GRAPH = "https://graph.microsoft.com/v1.0";
const FILE = "data.json";
const ITEM = `${GRAPH}/me/drive/special/approot:/${FILE}`;

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

export async function uploadData(token: string, data: unknown): Promise<RemoteMeta> {
  const res = await fetch(`${ITEM}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Graph upload-fout: ${res.status}`);
  const j = await res.json();
  return { id: j.id, eTag: j.eTag, lastModified: j.lastModifiedDateTime, size: j.size };
}
