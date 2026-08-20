import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

/** Acceptation d'une invitation, depuis sa notification ou depuis le lien recu par
 * email. Le serveur marque lui-meme la notification comme traitee, et l'utilisateur
 * gagne un projet — d'ou les deux branches invalidees. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => api.invitations.accept(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}
