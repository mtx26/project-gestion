import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-1 bg-background px-5 py-10">
      <View className="mx-auto w-full max-w-[440px] flex-1 justify-center">
        <Text className="text-sm font-semibold text-primary">Project Gestion</Text>
        <Text className="mt-2 text-2xl font-semibold text-foreground">{title}</Text>
        {subtitle ? <Text className="mt-2 text-sm leading-6 text-muted">{subtitle}</Text> : null}
        <View className="mt-6 rounded-md border border-border bg-surface p-4">{children}</View>
      </View>
    </View>
  );
}

export function Field({
  label,
  error,
  secureTextEntry,
  value,
  onChangeText,
  autoCapitalize = "none",
}: {
  label: string;
  error?: string;
  secureTextEntry?: boolean;
  value?: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        className="h-11 rounded-md border border-border bg-white px-3 text-foreground"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const classes = {
    primary: "bg-primary",
    secondary: "bg-slate-100 border border-border",
    ghost: "bg-transparent",
    danger: "bg-danger",
  }[variant];
  const textClasses = variant === "primary" || variant === "danger" ? "text-white" : "text-foreground";

  return (
    <Pressable
      className={`h-11 items-center justify-center rounded-md px-4 ${classes} ${disabled ? "opacity-60" : ""}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className={`text-sm font-semibold ${textClasses}`}>{children}</Text>
    </Pressable>
  );
}

export function Message({ children, danger }: { children?: ReactNode; danger?: boolean }) {
  if (!children) {
    return null;
  }
  return (
    <View className={`rounded-md border p-3 ${danger ? "border-red-200 bg-red-50" : "border-teal-200 bg-teal-50"}`}>
      <Text className={`text-sm leading-5 ${danger ? "text-red-700" : "text-teal-800"}`}>{children}</Text>
    </View>
  );
}

