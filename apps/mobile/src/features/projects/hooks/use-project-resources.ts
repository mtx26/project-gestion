import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export function useProjectMembers(projectId: number | null) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : queryKeys.disabled(),
    queryFn: () => api.members.list(projectId!),
    enabled: Boolean(projectId),
  });

  return { ...query, members: normalizeApiList(query.data) };
}

export function useProjectFolders(projectId: number | null) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId, { includeFiles: false }) : queryKeys.disabled(),
    queryFn: () => api.folders.tree(projectId!, { includeFiles: false }),
    enabled: Boolean(projectId),
  });

  return { ...query, folders: query.data ?? [] };
}
