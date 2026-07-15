import { supabase } from "@/lib/supabase";

const BASE_URL =
  "https://dvauueqtqrveqcckfrjx.supabase.co/functions/v1/influencer-api";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YXV1ZXF0cXJ2ZXFjY2tmcmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTQ3NDMsImV4cCI6MjA4NzAzMDc0M30.Zpxj1of_wLzpqMDG72S00gpQPwi7kPpgrslcDfQXHV8";

export async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string | null } = {},
): Promise<unknown> {
  const { method = "GET", body, accessToken } = options;
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "API error");
  return data;
}

/** Calls apiRequest with automatic token refresh when the session is close to expiry. */
export async function apiRequestWithRefresh(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  let session: any = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data?.session ?? null;
  } catch {
    // "Failed to fetch" can happen if the refresh token is expired or
    // there's a network issue. Sign out so the auth guard sends the user
    // to the login screen instead of silently failing.
    try {
      await supabase.auth.signOut();
    } catch {}
    throw new Error("Session expired. Please sign in again.");
  }

  if (!session) throw new Error("Not authenticated");

  const expiresAt = session.expires_at ?? 0;
  if (Date.now() / 1000 > expiresAt - 60) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) {
        await supabase.auth.signOut().catch(() => {});
        throw new Error("Session expired. Please sign in again.");
      }
      return apiRequest(path, {
        ...options,
        accessToken: refreshed.session.access_token,
      });
    } catch (e: any) {
      // If refresh fails, sign out and rethrow a user-friendly message
      if (e?.message !== "Session expired. Please sign in again.") {
        await supabase.auth.signOut().catch(() => {});
        throw new Error("Session expired. Please sign in again.");
      }
      throw e;
    }
  }

  return apiRequest(path, { ...options, accessToken: session.access_token });
}
