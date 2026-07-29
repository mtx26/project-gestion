import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";

interface FormScreenProps {
  title: string;
  cancelLabel?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  children: ReactNode;
}

/** Modal create/edit form shell — a native header with Cancel/Save actions
 * (like a system "New Contact"/"New Event" sheet), not the centered branded
 * card used for auth screens. Header actions stay reachable regardless of
 * scroll position, matching web's FormDialog (fixed header + footer). */
export function FormScreen({
  title,
  cancelLabel = "Annuler",
  submitLabel,
  onCancel,
  onSubmit,
  submitDisabled,
  children,
}: FormScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      {/* headerShown is intentionally NOT set here — it's static (true) on the
          Stack.Screen declaration in (app)/_layout.tsx. Toggling it dynamically
          on a modal-presented route crashes React Navigation with a remount loop. */}
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.foreground,
          headerLeft: () => (
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              className="h-11 min-w-[44px] items-start justify-center"
            >
              <Text className="text-base text-foreground">{cancelLabel}</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={onSubmit}
              disabled={submitDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(submitDisabled) }}
              className="h-11 min-w-[44px] items-end justify-center"
              style={{ opacity: submitDisabled ? 0.5 : 1 }}
            >
              <Text className="text-base font-semibold text-primary">{submitLabel}</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
