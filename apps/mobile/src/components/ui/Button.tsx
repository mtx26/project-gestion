import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { theme } from "../../theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const containerClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "border border-border bg-surface",
  ghost: "bg-transparent",
  danger: "bg-danger",
};

const textClasses: Record<ButtonVariant, string> = {
  primary: "text-primaryForeground",
  secondary: "text-foreground",
  ghost: "text-foreground",
  danger: "text-primaryForeground",
};

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className={`h-11 min-h-[44px] items-center justify-center rounded-md px-4 ${containerClasses[variant]} ${disabled ? "opacity-60" : ""}`}
    >
      <Text className={`text-sm font-semibold ${textClasses[variant]}`}>{children}</Text>
    </Pressable>
  );
}
