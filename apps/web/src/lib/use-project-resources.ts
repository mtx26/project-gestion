"use client";

import { buildProjectFoldersQuery, buildProjectMembersQuery, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { buildFolderNameMap } from "@/lib/folder-utils";
import { invalidateProjectResource } from "@/lib/invalidate-project-resource";

/** Any mutation that changes the folder structure (create/rename/move/delete) must
 * invalidate every variant of the tree — explorateur de fichiers, filtre dossier et
 * selecteur de cible partagent un seul endpoint, donc une seule cle prefixe
 * (`allTree`) les couvre toutes : aucune variante ne peut survivre perimee au
 * changement de structure. */
export function invalidateFolderTrees(queryClient: QueryClient, projectId: number) {
  return invalidateProjectResource(queryClient, queryKeys.folders.allTree(projectId));
}

export function useProjectResources(
  projectId: number | null,
  {
    canView,
    canEdit,
    canFetchMembers,
  }: {
    canView: boolean;
    canEdit: boolean;
    canFetchMembers?: boolean;
  },
) {
  const queryClient = useQueryClient();

  const foldersQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId, { includeFiles: false }) : queryKeys.disabled(),
    queryFn: () => buildProjectFoldersQuery(api, projectId!).queryFn(),
    enabled: Boolean(projectId && canView),
  });

  // Meme endpoint que `foldersQuery`, en mode selecteur de cible : dossiers + toutes les
  // taches. Requete distincte plutot que le sur-ensemble unique, pour ne pas charger les
  // taches sur une page qui n'en a pas besoin (et qui n'a pas forcement le droit d'ecrire).
  const targetTreeQuery = useQuery({
    queryKey: projectId
      ? queryKeys.folders.tree(projectId, { includeFiles: false, includeTasks: true, taskScope: "all" })
      : queryKeys.disabled(),
    queryFn: () => api.folders.tree(projectId!, { includeFiles: false, includeTasks: true, taskScope: "all" }),
    enabled: Boolean(projectId && canEdit),
  });

  const membersQuery = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : queryKeys.disabled(),
    queryFn: () => buildProjectMembersQuery(api, projectId!).queryFn(),
    enabled: Boolean(projectId && (canFetchMembers ?? canView)),
  });

  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(projectId!, { name, parent_folder: parentId }),
    onSuccess: () => invalidateFolderTrees(queryClient, projectId!),
    onError: toastError,
  });

  const folders = useMemo(() => foldersQuery.data ?? [], [foldersQuery.data]);
  const targetFolders = useMemo(() => targetTreeQuery.data ?? [], [targetTreeQuery.data]);
  const members = useMemo(() => normalizeApiList(membersQuery.data), [membersQuery.data]);
  const folderNameById = useMemo(() => buildFolderNameMap(folders), [folders]);

  async function handleCreateFolder(name: string, parentId: number | null) {
    await createFolder.mutateAsync({ name, parentId });
  }

  return { folders, targetFolders, members, folderNameById, handleCreateFolder };
}
