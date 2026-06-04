import { useCallback, useMemo, useState } from "react";

export interface AuthCredentialsController {
  email: string;
  password: string;
  setEmail(email: string): void;
  setPassword(password: string): void;
  reset(): void;
}

export function useAuthCredentials(): AuthCredentialsController {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const reset = useCallback(() => {
    setEmail("");
    setPassword("");
  }, []);

  return useMemo(
    () => ({
      email,
      password,
      setEmail,
      setPassword,
      reset,
    }),
    [email, password, reset]
  );
}
