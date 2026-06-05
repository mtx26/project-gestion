import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase-server";
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  getSafeNext,
  withLoginNext,
} from "../../../features/auth/routes";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const code = url.searchParams.get("code");
  const nextPath = getSafeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(withLoginNext(nextPath), origin));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(withLoginNext(nextPath), origin));
  }

  return NextResponse.redirect(
    new URL(nextPath || DEFAULT_AUTH_REDIRECT_PATH, origin)
  );
}
