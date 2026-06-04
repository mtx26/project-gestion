import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "../../lib/supabase-server";
import { getNextFromSearch, withAuthRedirectNext } from "../../features/auth/routes";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const requestHeaders = await headers();
    const currentPath = requestHeaders.get("x-current-path") ?? "";
    const currentUrl = new URL(currentPath, "http://project-gestion.local");

    redirect(withAuthRedirectNext(getNextFromSearch(currentUrl.searchParams)));
  }

  return children;
}
