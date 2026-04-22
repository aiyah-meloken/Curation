// Authing refresh_token grant — swaps refresh_token + access_token atomically and
// returns the new access_token. Concurrent callers share a single in-flight Promise.

const AUTHING_DOMAIN = (import.meta.env.VITE_AUTHING_DOMAIN as string) || "https://curation.authing.cn";
const AUTHING_APP_ID = import.meta.env.VITE_AUTHING_APP_ID as string;
const STORAGE_KEY = "curation_auth";

let _inFlight: Promise<string | null> | null = null;

type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  user: unknown;
};

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function writeStored(next: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function clearStored(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function refreshAccessToken(): Promise<string | null> {
  if (_inFlight) return _inFlight;

  _inFlight = (async () => {
    const stored = readStored();
    if (!stored?.refreshToken) return null;

    try {
      const resp = await fetch(`${AUTHING_DOMAIN}/oidc/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: stored.refreshToken,
          client_id: AUTHING_APP_ID,
        }),
      });

      if (!resp.ok) {
        clearStored();
        window.dispatchEvent(new Event("auth:expired"));
        return null;
      }

      const data = (await resp.json()) as { access_token?: string; refresh_token?: string };
      if (!data.access_token || !data.refresh_token) {
        clearStored();
        window.dispatchEvent(new Event("auth:expired"));
        return null;
      }

      writeStored({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: stored.user,
      });
      return data.access_token;
    } catch {
      clearStored();
      window.dispatchEvent(new Event("auth:expired"));
      return null;
    } finally {
      _inFlight = null;
    }
  })();

  return _inFlight;
}
