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
import {
  LOGIN_PATH,
  withAuthRedirectNext,
} from "../routes";

export function RegisterScreen() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const emailRedirectTo =
    typeof window === "undefined"
      ? undefined
      : window.location.origin + withAuthRedirectNext();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const trimmedName = name.trim();
      const trimmedAvatarUrl = avatarUrl.trim();

      if (!trimmedName) {
        setMessage("Name is required.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            name: trimmedName,
            ...(trimmedAvatarUrl ? { avatar_url: trimmedAvatarUrl } : {}),
          },
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace(withAuthRedirectNext());
        return;
      }

      setMessage("Check your email to confirm your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to register.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>
      <AuthGoogleButton onError={setMessage} />
      <p>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
        />
      </p>
      <p>
        <label htmlFor="avatarUrl">Profile picture URL</label>
        <input
          id="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://example.com/avatar.png"
        />
      </p>
      <AuthEmailInput value={email} onChange={setEmail} />
      <AuthPasswordInput
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
      <AuthSubmitButton disabled={false} label="Register" />
      <p>
        <Link href={LOGIN_PATH}>Already have an account?</Link>
      </p>
      <AuthMessage message={message} />
    </form>
  );
}
