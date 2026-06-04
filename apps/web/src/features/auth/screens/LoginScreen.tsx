"use client";

import { FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthCredentials, useSupabaseAuth } from "@project-gestion/auth";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { AuthEmailInput } from "../components/AuthEmailInput";
import { AuthMessage } from "../components/AuthMessage";
import { AuthPasswordInput } from "../components/AuthPasswordInput";
import { AuthSession } from "../components/AuthSession";
import { AuthSubmitButton } from "../components/AuthSubmitButton";

export function LoginScreen() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const auth = useSupabaseAuth(supabase);
  const credentials = useAuthCredentials();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await auth.signInWithPassword(credentials.email, credentials.password);

    if (!result.error) {
      router.replace("/secure");
    }
  }

  useEffect(() => {
    if (auth.user) {
      router.replace("/secure");
    }
  }, [auth.user, router]);

  if (auth.user) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      <AuthEmailInput value={credentials.email} onChange={credentials.setEmail} />
      <AuthPasswordInput
        autoComplete="current-password"
        value={credentials.password}
        onChange={credentials.setPassword}
      />
      <AuthSubmitButton disabled={auth.loading} label="Login" />
      <p>
        <Link href="/register">Create an account</Link>
      </p>
      <AuthMessage message={auth.message} />
    </form>
  );
}
