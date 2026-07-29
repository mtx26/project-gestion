import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(drawer)" />
      <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
      <Stack.Screen name="account" options={{ presentation: "modal" }} />
      <Stack.Screen name="projects/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="tasks/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="tasks/[id]/index" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="tasks/[id]/edit" options={{ presentation: "modal", headerShown: true }} />
    </Stack>
  );
}
