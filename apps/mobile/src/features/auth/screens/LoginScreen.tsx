import React from "react";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { useAuthCredentials, useSupabaseAuth } from "@project-gestion/auth";
import { supabase } from "../../../lib/supabase";
import { AuthEmailInput } from "../components/AuthEmailInput";
import { AuthMessage } from "../components/AuthMessage";
import { AuthPasswordInput } from "../components/AuthPasswordInput";
import { AuthSession } from "../components/AuthSession";
import { AuthSubmitButton } from "../components/AuthSubmitButton";

export function LoginScreen() {
  const auth = useSupabaseAuth(supabase);
  const credentials = useAuthCredentials();

  async function handleSubmit() {
    await auth.signInWithPassword(credentials.email, credentials.password);
  }

  if (auth.user) {
    return <AuthSession auth={auth} />;
  }

  return (
    <View>
      <Text>Login</Text>
      <AuthEmailInput value={credentials.email} onChange={credentials.setEmail} />
      <AuthPasswordInput
        autoComplete="current-password"
        value={credentials.password}
        onChange={credentials.setPassword}
      />
      <AuthSubmitButton
        disabled={auth.loading}
        label="Login"
        onPress={handleSubmit}
      />
      <Link href="/register">Create an account</Link>
      <AuthMessage message={auth.message} />
    </View>
  );
}
