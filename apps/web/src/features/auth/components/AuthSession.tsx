"use client";

import type { AuthController } from "@project-gestion/auth";
import { AuthMessage } from "./AuthMessage";

interface AuthSessionProps {
  auth: AuthController;
}

export function AuthSession({ auth }: AuthSessionProps) {
  if (!auth.user) {
    return null;
  }

  return (
    <section>
      <p>{auth.user.email}</p>
      <button type="button" onClick={auth.signOut} disabled={auth.loading}>
        Sign out
      </button>
      <AuthMessage message={auth.message} />
    </section>
  );
}
