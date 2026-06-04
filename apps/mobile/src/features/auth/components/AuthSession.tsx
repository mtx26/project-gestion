import React from "react";
import { Button, Text, View } from "react-native";
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
    <View>
      <Text>{auth.user.email}</Text>
      <Button title="Sign out" onPress={auth.signOut} disabled={auth.loading} />
      <AuthMessage message={auth.message} />
    </View>
  );
}
