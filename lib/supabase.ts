import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL. Configure it in the environment before using Supabase."
  );
}

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseKey) {
  throw new Error(
    "Missing Supabase public key. Configure NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before using Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function testSupabaseConnection() {
  const { data, error } = await supabase.from("products").select("*").limit(1);

  return { data, error };
}
