import "react-native-gesture-handler";
import "../global.css";

import { theme } from "@project-gestion/config";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      {/* Hors des deux groupes : un lien d'invitation peut arriver connecte ou non,
          et c'est l'ecran lui-meme qui gere les deux cas. */}
      <Stack.Screen name="invitations/accept" />
    </Stack>
  );
}

export default function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <AppProviders queryClient={queryClient}>
      {/* Le theme de l'app est clair (`userInterfaceStyle: "light"`) : on force des
          icones sombres, sinon Android suit le theme du systeme et l'heure devient
          illisible sur nos fonds clairs. */}
      <StatusBar style="dark" />
      <RootLayoutNav />
    </AppProviders>
  );
}

/** Filet de securite d'expo-router : sans lui, une erreur de rendu laisse un ecran
 * blanc en production (et seulement l'ecran rouge en dev). `retry` remonte le
 * sous-arbre, ce qui suffit pour une erreur passagere (reseau, donnee inattendue). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text className="text-xl font-semibold text-foreground">Une erreur est survenue</Text>
        <Text className="text-sm text-muted">{error.message}</Text>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          className="h-11 items-center justify-center rounded-md bg-primary"
        >
          <Text className="text-sm font-semibold text-primaryForeground">Reessayer</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
