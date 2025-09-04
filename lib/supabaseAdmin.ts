import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? // <- nom standard
    process.env.SUPABASE_SERVICE_ROLE;       // <- fallback si tu as déjà ce nom

  if (!url) throw new Error("Missing env SUPABASE_URL");
  if (!key) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE)");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "rr-abgleich-admin" } },
  });
}
