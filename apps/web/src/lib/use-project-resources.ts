"use client";

import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { buildFolderNameMap } from "@/lib/folder-utils";
import { invalidateProjectResource } from "@/lib/invalidate-project-resource";

/** Any mutation that changes the folder structure (create/rename/move/delete) must
 * invalidate both trees — `allTree` (file browser) and `targetTree` (folder pickers
 * used to link tasks/finance/time entries to a folder) — so a stale target tree
 * can't outlive the structural change that just happened. */
export function invalidateFolderTrees(queryClient: QueryClient, projectId: number) {
  return Promise.all([
    invalidateProjectResource(queryClient, queryKeys.folders.allTree(projectId)),
    invalidateProjectResource(queryClient, queryKeys.folders.targetTree(projectId)),
  ]);
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
    queryFn: () => api.folders.tree(projectId!, { includeFiles: false }),
    enabled: Boolean(projectId && canView),
  });

  const targetTreeQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.targetTree(projectId) : queryKeys.disabled(),
    queryFn: () => api.folders.targetTree(projectId!),
    enabled: Boolean(projectId && canEdit),
  });

  const membersQuery = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : queryKeys.disabled(),
    queryFn: () => api.members.list(projectId!),
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
