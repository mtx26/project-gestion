import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./supabase-server-client";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Server Components cannot always write cookies. Middleware refreshes them.
      }
    },
  });
}
