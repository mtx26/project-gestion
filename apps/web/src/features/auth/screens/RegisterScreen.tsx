"use client";

import { FormEvent } from "react";
import Link from "next/link";
import { useAuthCredentials, useSupabaseAuth } from "@project-gestion/auth";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { AuthEmailInput } from "../components/AuthEmailInput";
import { AuthMessage } from "../components/AuthMessage";
import { AuthPasswordInput } from "../components/AuthPasswordInput";
import { AuthSession } from "../components/AuthSession";
import { AuthSubmitButton } from "../components/AuthSubmitButton";
import { getRegisterRedirect } from "../redirects";

export function RegisterScreen() {
  const supabase = getSupabaseBrowserClient();
  const auth = useSupabaseAuth(supabase, {
    redirects: getRegisterRedirect,
  });
  const credentials = useAuthCredentials();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await auth.signUpWithPassword(credentials.email, credentials.password);
  }

  if (auth.user) {
    return <AuthSession auth={auth} />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>
      <AuthEmailInput value={credentials.email} onChange={credentials.setEmail} />
      <AuthPasswordInput
        autoComplete="new-password"
        value={credentials.password}
        onChange={credentials.setPassword}
      />
      <AuthSubmitButton disabled={auth.loading} label="Register" />
      <p>
        <Link href="/login">Already have an account?</Link>
      </p>
      <AuthMessage message={auth.message} />
    </form>
  );
}
