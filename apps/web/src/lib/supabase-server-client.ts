import { createServerClient } from "@supabase/ssr/dist/module/createServerClient";
import type { CookieMethodsServer } from "@supabase/ssr";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return { supabaseUrl, supabaseKey };
}

export function createSupabaseServerClient(cookies: CookieMethodsServer) {
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies,
  });
}
