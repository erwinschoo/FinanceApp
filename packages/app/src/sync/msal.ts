import { PublicClientApplication, type AccountInfo } from "@azure/msal-browser";

/* Client-ID komt uit een env-var zodat er niets aan een specifiek account vastzit in de code.
 * Zet VITE_MS_CLIENT_ID in een .env-bestand (zie .env.example). */
export const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID as string | undefined;
export const GRAPH_SCOPES = ["User.Read", "Files.ReadWrite.AppFolder"];

export function isSyncConfigured(): boolean {
  return !!MS_CLIENT_ID;
}

let pca: PublicClientApplication | null = null;
let initialized = false;

export async function getPca(): Promise<PublicClientApplication> {
  if (!MS_CLIENT_ID) throw new Error("VITE_MS_CLIENT_ID ontbreekt — sync is niet geconfigureerd.");
  if (!pca) {
    pca = new PublicClientApplication({
      auth: {
        clientId: MS_CLIENT_ID,
        authority: "https://login.microsoftonline.com/consumers",
        redirectUri: window.location.origin + import.meta.env.BASE_URL,
      },
      cache: { cacheLocation: "localStorage" },
    });
  }
  if (!initialized) {
    await pca.initialize();
    initialized = true;
  }
  return pca;
}

export function getAccount(): AccountInfo | null {
  if (!pca) return null;
  return pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
}

export async function signIn(): Promise<AccountInfo> {
  const app = await getPca();
  const res = await app.loginPopup({ scopes: GRAPH_SCOPES });
  app.setActiveAccount(res.account);
  return res.account;
}

export async function signOut(): Promise<void> {
  const app = await getPca();
  const account = getAccount();
  await app.logoutPopup({ account: account ?? undefined });
}

export async function getToken(): Promise<string> {
  const app = await getPca();
  const account = getAccount();
  if (!account) throw new Error("Niet ingelogd.");
  try {
    const res = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return res.accessToken;
  } catch {
    const res = await app.acquireTokenPopup({ scopes: GRAPH_SCOPES, account });
    return res.accessToken;
  }
}

/* Stille token-acquisitie zonder popup-fallback — voor achtergrondtaken (profielfoto)
 * die nooit een inlog-popup mogen openen. Geeft null als het niet stil lukt. */
export async function getTokenSilent(): Promise<string | null> {
  const app = await getPca();
  const account = getAccount();
  if (!account) return null;
  try {
    const res = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return res.accessToken;
  } catch {
    return null;
  }
}

/* Token met de Mail.Send-scope — voor het feedback-formulier (Graph /me/sendMail).
 * Bewust NIET in GRAPH_SCOPES opgenomen: anders zou elke sync-gebruiker bij het
 * verbinden onnodig toestemming voor het versturen van e-mail moeten geven. We vragen
 * de scope incrementeel op, en loggen eerst in als er nog geen account is. */
export async function acquireMailToken(): Promise<string> {
  const app = await getPca();
  let account = getAccount();
  if (!account) account = await signIn();
  const req = { scopes: ["Mail.Send"], account };
  try {
    return (await app.acquireTokenSilent(req)).accessToken;
  } catch {
    return (await app.acquireTokenPopup(req)).accessToken; // eerste keer: consent-popup
  }
}
