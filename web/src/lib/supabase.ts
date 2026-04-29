import { createClient } from "@supabase/supabase-js";

// Fall back to a placeholder so the landing page still renders without .env.local.
// Pages that actually talk to Supabase (feature-requests, admin) require real credentials.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
