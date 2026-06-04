import React from "react";
import { Text, TextInput } from "react-native";

interface AuthEmailInputProps {
  value: string;
  onChange(value: string): void;
}

export function AuthEmailInput({ value, onChange }: AuthEmailInputProps) {
  return (
    <>
      <Text>Email</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
    </>
  );
}
