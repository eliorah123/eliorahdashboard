// Re-export the canonical client from src/lib/supabase.ts
// Use `@/lib/supabase` in all src/ files; this file exists for root-level tooling.
export { supabase, isSupabaseConfigured } from "../src/lib/supabase";
