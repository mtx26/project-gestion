import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { usePushNotifications } from "../../src/features/notifications/hooks/use-push-notifications";
import { useInvitationStore } from "../../src/stores/invitation-store";

export default function AppLayout() {
  const router = useRouter();
  const pendingInvitationToken = useInvitationStore((state) => state.pendingToken);

  // Ce layout n'est monte que dans le groupe protege : y brancher le push evite de
  // demander la permission a quelqu'un qui n'est pas connecte.
  usePushNotifications();

  // Un lien d'invitation ouvert avant la connexion attendait la fin du login : on
  // le rejoue des que le groupe authentifie est monte.
  useEffect(() => {
    if (pendingInvitationToken) {
      router.replace({ pathname: "/invitations/accept", params: { token: pendingInvitationToken } });
    }
  }, [pendingInvitationToken, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(drawer)" />
      <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
      <Stack.Screen name="account" options={{ presentation: "modal" }} />
      <Stack.Screen name="projects/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="tasks/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="tasks/[id]/index" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="tasks/[id]/edit" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="time/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="time/[id]/index" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="time/[id]/edit" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="finance/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="finance/[id]/index" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="finance/[id]/edit" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="settings/general" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="settings/members" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="settings/roles/index" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="settings/roles/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="settings/roles/[id]/edit" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="requests/create" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="requests/[id]/index" options={{ headerShown: true, headerBackTitle: "" }} />
      <Stack.Screen name="requests/[id]/edit" options={{ presentation: "modal", headerShown: true }} />
    </Stack>
  );
}
