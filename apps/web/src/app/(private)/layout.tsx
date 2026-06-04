import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "../../lib/supabase-server";
import { withLoginNext } from "../../features/auth/routes";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const requestHeaders = await headers();
    redirect(withLoginNext(requestHeaders.get("x-current-path")));
  }

  return children;
}
