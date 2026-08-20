import { queryKeys } from "@project-gestion/query-keys";
import type { FolderTreeNode } from "@project-gestion/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PendingUpload } from "../../../lib/document-picker";
import { api } from "../../../lib/api";

/** Toute mutation qui change la structure doit invalider *toutes* les variantes de
 * l'arbre (explorateur, filtre dossier, selecteur de cible) : elles partagent un seul
 * endpoint, donc la cle prefixe `allTree` les couvre d'un coup. */
function useTreeInvalidation(projectId: number | null) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.folders.allTree(projectId!) });
}

/** Arbre complet du projet : dossiers + documents. Les taches sont demandees a part
 * (carte d'en-tete du dossier ouvert), pour ne pas melanger deux natures d'elements
 * dans la meme liste sur un petit ecran. */
export function useProjectTree(projectId: number | null) {
  const query = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId, { includeFiles: true }) : queryKeys.disabled(),
    queryFn: () => api.folders.tree(projectId!, { includeFiles: true }),
    enabled: Boolean(projectId),
  });

  return { ...query, tree: (query.data ?? []) as FolderTreeNode[] };
}

export function useCreateFolder(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: ({ name, parentFolder }: { name: string; parentFolder: number | null }) =>
      api.folders.create(projectId!, { name, parent_folder: parentFolder }),
    onSuccess: invalidate,
  });
}

export function useRenameFolder(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: number; name: string }) =>
      api.folders.update(projectId!, folderId, { name }),
    onSuccess: invalidate,
  });
}

export function useMoveFolder(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: ({ folderId, newParentId }: { folderId: number; newParentId: number | null }) =>
      api.folders.update(projectId!, folderId, { parent_folder: newParentId }),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: (folderId: number) => api.folders.remove(projectId!, folderId),
    onSuccess: invalidate,
  });
}

export function useUploadDocument(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: ({ file, folder }: { file: PendingUpload; folder: number | null }) =>
      api.documents.upload(projectId!, { file, folder, name: file.name }),
    onSuccess: invalidate,
  });
}

export function useRenameDocument(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: ({ documentId, name }: { documentId: number; name: string }) =>
      api.documents.update(projectId!, documentId, { name }),
    onSuccess: invalidate,
  });
}

export function useMoveDocument(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: ({ documentId, folder }: { documentId: number; folder: number | null }) =>
      api.documents.update(projectId!, documentId, { folder }),
    onSuccess: invalidate,
  });
}

export function useDeleteDocument(projectId: number | null) {
  const invalidate = useTreeInvalidation(projectId);

  return useMutation({
    mutationFn: (documentId: number) => api.documents.remove(projectId!, documentId),
    onSuccess: invalidate,
  });
}
