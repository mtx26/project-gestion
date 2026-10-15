import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { DetailScreen } from "../../../components/layout/DetailScreen";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/errors";
import { successFeedback } from "../../../lib/haptics";
import { useAuthStore } from "../../../stores/auth-store";
import { useInvitationStore } from "../../../stores/invitation-store";
import { useProjectStore } from "../../../stores/project-store";
import { useAcceptInvitation } from "../hooks/use-accept-invitation";

/** Cible du lien `projectgestion://invitations/accept?token=...` envoye par email.
 *
 * Vit a la racine des routes (hors des groupes proteges) : un lien peut tres bien
 * arriver alors que personne n'est connecte. Dans ce cas le jeton est mis de cote,
 * l'utilisateur se connecte, et le layout du groupe authentifie rejoue le lien. */
export function InvitationAcceptScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setPendingToken = useInvitationStore((state) => state.setPendingToken);
  const clearPendingToken = useInvitationStore((state) => state.clearPendingToken);
  const selectProject = useProjectStore((state) => state.selectProject);
  const acceptInvitation = useAcceptInvitation();

  // Une seule tentative par montage : sans ce garde, un rendu de plus rejouerait
  // l'acceptation (et le serveur repondrait "deja acceptee").
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!token || attemptedRef.current) {
      return;
    }
    if (!isAuthenticated) {
      setPendingToken(token);
      return;
    }
    attemptedRef.current = true;
    clearPendingToken();
    acceptInvitation.mutate(token, { onSuccess: () => successFeedback() });
    // `acceptInvitation` change d'identite a chaque rendu : le declencheur est le
    // jeton et l'etat d'authentification, rien d'autre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated]);

  const member = acceptInvitation.data?.member ?? null;

  return (
    <DetailScreen includeTopEdge>
      <View className="flex-1 justify-center gap-4 px-5">
        <Text className="text-2xl font-semibold text-foreground">Invitation</Text>

        {!token ? (
          <ErrorState message="Ce lien d'invitation est incomplet." />
        ) : !isAuthenticated ? (
          <>
            <Text className="text-sm text-muted">
              Connecte-toi pour rejoindre le projet : l&apos;invitation sera acceptee juste apres.
            </Text>
            <Button onPress={() => router.replace("/")}>Se connecter</Button>
          </>
        ) : acceptInvitation.isPending ? (
          <LoadingState />
        ) : acceptInvitation.isError ? (
          <>
            <ErrorState message={getErrorMessage(acceptInvitation.error)} />
            <Button variant="secondary" onPress={() => router.replace("/")}>
              Retour
            </Button>
          </>
        ) : acceptInvitation.isSuccess ? (
          <>
            <Text className="text-sm text-muted">Tu as rejoint le projet.</Text>
            <Button
              onPress={() => {
                if (member) {
                  selectProject(member.project);
                }
                router.replace("/");
              }}
            >
              Ouvrir le projet
            </Button>
          </>
        ) : (
          <LoadingState />
        )}
      </View>
    </DetailScreen>
  );
}
