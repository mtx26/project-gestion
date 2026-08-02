import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mx-auto w-full max-w-[440px]">
            <Text className="text-sm font-semibold text-primary" accessibilityRole="header">
              Project Gestion
            </Text>
            <Text className="mt-2 text-2xl font-semibold text-foreground">{title}</Text>
            {subtitle ? <Text className="mt-2 text-sm leading-6 text-muted">{subtitle}</Text> : null}
            <View className="mt-6 gap-4 rounded-md border border-border bg-surface p-4">{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
