import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface InlineMessageProps {
  children?: ReactNode;
  variant?: "info" | "danger";
}

export function InlineMessage({ children, variant = "info" }: InlineMessageProps) {
  if (!children) {
    return null;
  }

  const isDanger = variant === "danger";

  return (
    <View
      className={`rounded-md border p-3 ${isDanger ? "border-danger/30 bg-danger/10" : "border-primary/30 bg-primary/10"}`}
      accessibilityRole="alert"
    >
      <Text className={`text-sm leading-5 ${isDanger ? "text-danger" : "text-primary"}`}>{children}</Text>
    </View>
  );
}
