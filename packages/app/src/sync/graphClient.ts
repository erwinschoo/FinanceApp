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
