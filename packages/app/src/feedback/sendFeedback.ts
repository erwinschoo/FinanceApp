/* Verstuurt een feedback-/bugmelding als e-mail via Microsoft Graph (/me/sendMail),
 * vanuit de eigen mailbox van de ingelogde gebruiker. Hergebruikt de bestaande MSAL-
 * integratie; afbeeldingen worden client-side verkleind/gecomprimeerd zodat het bericht
 * ruim onder de ~3 MB-limiet van de eenvoudige sendMail (zonder upload-sessie) blijft. */
import { acquireMailToken } from "../sync/msal";

const GRAPH = "https://graph.microsoft.com/v1.0";

/* Eén plek om het ontvangst-adres te wijzigen. */
export const FEEDBACK_TO = "e.h.schoo@gmail.com";

/* Build-globals (gedefinieerd in vite.config.ts) — handig voor het reproduceren van bugs. */
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_DATE__: string;

export type FeedbackType = "idee" | "bug";

export interface FeedbackInput {
  type: FeedbackType;
  onderwerp: string;
  beschrijving: string;
  images: File[];
}

/* Grens voor het totale bericht: sendMail zonder upload-sessie accepteert ~4 MB.
 * We mikken op base64-payload < 3 MB zodat headers/overhead erbij passen. */
const MAX_TOTAL_B64 = 3 * 1024 * 1024;
const MAX_DIM = 1600; // langste zijde na verkleinen
const JPEG_QUALITY = 0.8;

interface Attachment {
  "@odata.type": "#microsoft.graph.fileAttachment";
  name: string;
  contentType: "image/jpeg";
  contentBytes: string; // base64 zonder data:-prefix
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Kon afbeelding niet lezen: ${file.name}`)); };
    img.src = url;
  });
}

/* Verkleint naar max. MAX_DIM op de langste zijde en comprimeert als JPEG.
 * Retourneert de base64-payload (zonder "data:image/jpeg;base64,"-prefix). */
async function compressToJpegBase64(file: File): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar.");
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function buildBody(input: FeedbackInput): string {
  const typeLabel = input.type === "bug" ? "Bug" : "Idee";
  return [
    `Type: ${typeLabel}`,
    "",
    input.beschrijving.trim(),
    "",
    "— diagnostiek —",
    `Versie: ${__APP_VERSION__} (${__GIT_COMMIT__})`,
    `Build: ${__BUILD_DATE__}`,
    `Browser: ${navigator.userAgent}`,
  ].join("\n");
}

export async function sendFeedbackMail(input: FeedbackInput): Promise<void> {
  const token = await acquireMailToken();

  const attachments: Attachment[] = [];
  let total = 0;
  for (let i = 0; i < input.images.length; i++) {
    const contentBytes = await compressToJpegBase64(input.images[i]);
    total += contentBytes.length;
    if (total > MAX_TOTAL_B64) {
      throw new Error("De afbeeldingen zijn samen te groot. Kies er minder of kleinere.");
    }
    attachments.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: `schermafbeelding-${i + 1}.jpg`,
      contentType: "image/jpeg",
      contentBytes,
    });
  }

  const payload = {
    message: {
      subject: `BOKKIEP - ${input.onderwerp.trim()}`,
      body: { contentType: "Text", content: buildBody(input) },
      toRecipients: [{ emailAddress: { address: FEEDBACK_TO } }],
      ...(attachments.length ? { attachments } : {}),
    },
    saveToSentItems: false,
  };

  const res = await fetch(`${GRAPH}/me/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Versturen mislukt (Graph ${res.status}).`);
  }
}
