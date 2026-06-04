import React from "react";
import { Text } from "react-native";

interface AuthMessageProps {
  message: string;
}

export function AuthMessage({ message }: AuthMessageProps) {
  if (!message) {
    return null;
  }

  return <Text>{message}</Text>;
}
