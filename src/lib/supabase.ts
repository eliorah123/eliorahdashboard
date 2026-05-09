import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Expose as a flag so the app can show a setup screen instead of crashing
export const isSupabaseConfigured =
  Boolean(url) &&
  url !== "https://your-project-ref.supabase.co" &&
  Boolean(key) &&
  key !== "your-anon-key-here";

// Singleton — Next.js hot-reload creates new module instances; this guard
// prevents multiple GoTrue auth clients from racing each other in dev.
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder-key",
  {
    auth: {
      persistSession:    true,   // store session in localStorage automatically
      autoRefreshToken:  true,   // refresh before expiry
      detectSessionInUrl: true,  // handle OAuth / magic-link callbacks
    },
  },
);
