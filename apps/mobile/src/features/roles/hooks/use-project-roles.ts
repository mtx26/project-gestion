import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { Permission, RolePayload } from "@project-gestion/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

function useRolesInvalidation(projectId: number | null) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(projectId!) });
    // Un role supprime ou modifie change les permissions des membres qui le portent.
    queryClient.invalidateQueries({ queryKey: queryKeys.members.list(projectId!) });
  };
}

export function useProjectRoles(projectId: number | null, enabled = true) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.roles.list(projectId) : queryKeys.disabled(),
    queryFn: () => api.roles.list(projectId!),
    enabled: Boolean(projectId) && enabled,
  });

  return { ...query, roles: normalizeApiList(query.data) };
}

/** Catalogue global des permissions (pas propre a un projet) : il alimente la
 * matrice de l'editeur de role. */
export function usePermissions(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.permissions.list(),
    queryFn: () => api.permissions.list(),
    enabled,
  });

  return { ...query, permissions: normalizeApiList(query.data) as Permission[] };
}

export function useCreateRole(projectId: number | null) {
  const invalidate = useRolesInvalidation(projectId);

  return useMutation({
    mutationFn: (payload: RolePayload) => api.roles.create(projectId!, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateRole(projectId: number | null) {
  const invalidate = useRolesInvalidation(projectId);

  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: RolePayload }) =>
      api.roles.update(projectId!, roleId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRole(projectId: number | null) {
  const invalidate = useRolesInvalidation(projectId);

  return useMutation({
    mutationFn: (roleId: number) => api.roles.remove(projectId!, roleId),
    onSuccess: invalidate,
  });
}
