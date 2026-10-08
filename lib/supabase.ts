import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return supabaseClient;
}

export async function testSupabaseConnection() {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error: new Error("Missing Supabase public URL or anon/publishable key."),
    };
  }

  return client.from("products").select("*").limit(1);
}
