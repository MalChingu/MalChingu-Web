import { createClient } from "@supabase/supabase-js";

// The same Supabase project as the iPhone/Mac app. The publishable key is safe to ship:
// every table is protected by row-level security.
export const SUPABASE_URL = "https://nxlsnpzfbazwlccxtwpt.supabase.co";
const SUPABASE_KEY = "sb_publishable_9G82LPPiH9TnoSOfoQkxQg_4OWTAPtj";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const CONNECTOR_BASE_URL = `${SUPABASE_URL}/functions/v1/mcp`;
