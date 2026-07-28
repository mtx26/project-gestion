import "../global.css";

import { theme } from "@project-gestion/config";
import { Stack } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { createQueryClient } from "../src/lib/query-client";
import { AppProviders } from "../src/providers/AppProviders";
import { useAuthStore } from "../src/stores/auth-store";

function RootLayoutNav() {
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <AppProviders queryClient={queryClient}>
      <RootLayoutNav />
    </AppProviders>
  );
}
