import React from "react";
import { Text, TextInput } from "react-native";

interface AuthPasswordInputProps {
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange(value: string): void;
}

export function AuthPasswordInput({
  autoComplete,
  value,
  onChange,
}: AuthPasswordInputProps) {
  return (
    <>
      <Text>Password</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoComplete={autoComplete}
        secureTextEntry
      />
    </>
  );
}
