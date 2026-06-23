"use client";

import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFolderNameMap } from "@/lib/folder-utils";

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
    queryKey: projectId ? queryKeys.folders.tree(projectId) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(projectId!),
    enabled: Boolean(projectId && canView),
  });

  const targetTreeQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.targetTree(projectId) : ["folders", "target-tree", "disabled"],
    queryFn: () => api.folders.targetTree(projectId!),
    enabled: Boolean(projectId && canEdit),
  });

  const membersQuery = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : ["members", "disabled"],
    queryFn: () => api.members.list(projectId!),
    enabled: Boolean(projectId && (canFetchMembers ?? canView)),
  });

  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(projectId!, { name, parent_folder: parentId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.tree(projectId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.targetTree(projectId!) }),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
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
