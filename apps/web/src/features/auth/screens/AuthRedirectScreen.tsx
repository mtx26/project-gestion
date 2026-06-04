"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  getNextFromSearch,
  LOGIN_PATH,
} from "../routes";

export function AuthRedirectScreen() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    return getNextFromSearch(new URLSearchParams(window.location.search));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then((result) => {
      router.replace(result.data.session ? nextPath : LOGIN_PATH);
    });
  }, [nextPath, router, supabase]);

  return null;
}
