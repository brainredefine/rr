import "server-only";
import { createClient } from "@supabase/supabase-js";

export function sbServer() {
  const url = process.env.SUPABASE_URL!;
  // En prod: utilise SERVICE_ROLE. En dev tu peux aussi, c'est côté serveur.
  const key = process.env.SUPABASE_SERVICE_ROLE!; 
  return createClient(url, key, { auth: { persistSession: false } });
}
