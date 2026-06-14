import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "./env";

export function createSupabaseAdmin() {
  return createClient(
    getRequiredEnv("SUPABASE_URL", ["URL"]),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", ["SERVICE_ROLE_KEY"]),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
