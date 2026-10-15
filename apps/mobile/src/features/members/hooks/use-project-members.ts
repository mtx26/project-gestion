import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

/** Le proprietaire du projet apparait dans la liste avec l'identifiant 0 : il n'a pas
 * de ligne `ProjectMember` en base, mais son taux horaire s'edite quand meme (via un
 * endpoint dedie). */
export const OWNER_MEMBER_ID = 0;

function useMembersInvalidation(projectId: number | null) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.members.list(projectId!) });
}

function useInvitationsInvalidation(projectId: number | null) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all(projectId!) });
}

export function useProjectInvitations(projectId: number | null, enabled = true) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.invitations.all(projectId) : queryKeys.disabled(),
    queryFn: () => api.invitations.list(projectId!),
    enabled: Boolean(projectId) && enabled,
  });

  return { ...query, invitations: normalizeApiList(query.data) };
}

export function useInviteMember(projectId: number | null) {
  const invalidate = useInvitationsInvalidation(projectId);

  return useMutation({
    mutationFn: ({ email, roleId }: { email: string; roleId: number }) =>
      api.invitations.create(projectId!, { email, role: roleId }),
    onSuccess: invalidate,
  });
}

export function useUpdateInvitationRole(projectId: number | null) {
  const invalidate = useInvitationsInvalidation(projectId);

  return useMutation({
    mutationFn: ({ invitationId, roleId }: { invitationId: number; roleId: number }) =>
      api.invitations.update(projectId!, invitationId, { role: roleId }),
    onSuccess: invalidate,
  });
}

export function useCancelInvitation(projectId: number | null) {
  const invalidate = useInvitationsInvalidation(projectId);

  return useMutation({
    mutationFn: (invitationId: number) => api.invitations.remove(projectId!, invitationId),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberRole(projectId: number | null) {
  const invalidate = useMembersInvalidation(projectId);

  return useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: number; roleId: number }) =>
      api.members.update(projectId!, memberId, { role: roleId }),
    onSuccess: invalidate,
  });
}

/** Le taux du proprietaire passe par son propre endpoint : il n'a pas d'identifiant
 * de membre a mettre a jour. */
export function useUpdateMemberRate(projectId: number | null) {
  const invalidate = useMembersInvalidation(projectId);

  return useMutation({
    mutationFn: ({ memberId, rate }: { memberId: number; rate: string }) =>
      memberId === OWNER_MEMBER_ID
        ? api.members.updateOwnerRate(projectId!, rate)
        : api.members.update(projectId!, memberId, { hourly_rate: rate }),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(projectId: number | null) {
  const invalidate = useMembersInvalidation(projectId);

  return useMutation({
    mutationFn: (memberId: number) => api.members.remove(projectId!, memberId),
    onSuccess: invalidate,
  });
}
