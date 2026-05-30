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
