import { createClient } from "@supabase/supabase-js";

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://gbgldkyyonctfhrnufbd.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_iR7uOisNOlPXc-WxTSNjtA_pY3Iz48f";

export const configured = Boolean(url && key);

// Remove credentials left by older versions; new sessions live only in memory.
try {
  const project = new URL(url).hostname.split(".")[0];
  localStorage.removeItem(`sb-${project}-auth-token`);
  sessionStorage.removeItem(`sb-${project}-auth-token`);
} catch {
  /* Storage can be unavailable in restricted browsers. */
}
export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// A restored back/forward-cache page must not revive an in-memory login.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    void supabase.auth
      .signOut({ scope: "local" })
      .finally(() => location.reload());
  }
});
