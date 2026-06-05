"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { AuthEmailInput } from "../components/AuthEmailInput";
import { AuthGoogleButton } from "../components/AuthGoogleButton";
import { AuthMessage } from "../components/AuthMessage";
import { AuthPasswordInput } from "../components/AuthPasswordInput";
import { AuthSubmitButton } from "../components/AuthSubmitButton";
import { getNextFromSearch, REGISTER_PATH, withAuthRedirectNext } from "../routes";

export function LoginScreen() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace(
        withAuthRedirectNext(
          getNextFromSearch(new URLSearchParams(window.location.search))
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      <AuthGoogleButton onError={setMessage} />
      <AuthEmailInput value={email} onChange={setEmail} />
      <AuthPasswordInput
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <AuthSubmitButton disabled={false} label="Login" />
      <p>
        <Link href={REGISTER_PATH}>Create an account</Link>
      </p>
      <AuthMessage message={message} />
    </form>
  );
}
