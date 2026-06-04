import React from "react";
import { Button } from "react-native";

interface AuthSubmitButtonProps {
  disabled: boolean;
  label: string;
  onPress(): void;
}

export function AuthSubmitButton({
  disabled,
  label,
  onPress,
}: AuthSubmitButtonProps) {
  return <Button title={label} onPress={onPress} disabled={disabled} />;
}
