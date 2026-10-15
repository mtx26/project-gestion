import { buildProjectFoldersQuery, buildProjectMembersQuery, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export function useProjectMembers(projectId: number | null) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : queryKeys.disabled(),
    queryFn: () => buildProjectMembersQuery(api, projectId!).queryFn(),
    enabled: Boolean(projectId),
  });

  return { ...query, members: normalizeApiList(query.data) };
}

export function useProjectFolders(projectId: number | null) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId, { includeFiles: false }) : queryKeys.disabled(),
    queryFn: () => buildProjectFoldersQuery(api, projectId!).queryFn(),
    enabled: Boolean(projectId),
  });

  return { ...query, folders: query.data ?? [] };
}

/** Meme endpoint que `useProjectFolders`, en mode selecteur de cible : dossiers +
 * toutes les taches (terminees comprises — on peut rattacher du temps a une tache
 * close). Requete distincte pour ne pas charger les taches sur les ecrans qui n'ont
 * besoin que des dossiers. */
export function useProjectTargetTree(projectId: number | null, enabled = true) {
  const query = useQuery({
    queryKey: projectId
      ? queryKeys.folders.tree(projectId, { includeFiles: false, includeTasks: true, taskScope: "all" })
      : queryKeys.disabled(),
    queryFn: () => api.folders.tree(projectId!, { includeFiles: false, includeTasks: true, taskScope: "all" }),
    enabled: Boolean(projectId) && enabled,
  });

  return { ...query, tree: query.data ?? [] };
}
