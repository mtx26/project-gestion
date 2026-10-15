import { getApiCount, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { PaginatedResponse } from "@project-gestion/types";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { TrashItem, TrashResource } from "../lib/trash-resources";

/** Appel API de la corbeille par ressource. Regroupe ici pour que l'ecran n'ait
 * qu'une ressource selectionnee a manipuler, au lieu d'une requete par onglet comme
 * le web. Le type de retour est annote explicitement : sans ca, TypeScript fige
 * l'union sur la premiere branche (les projets). */
function fetchTrash(
  projectId: number | null,
  resource: TrashResource,
  page: number,
): Promise<TrashItem[] | PaginatedResponse<TrashItem>> {
  if (resource === "projects") {
    return api.projects.trash();
  }
  const id = projectId!;
  switch (resource) {
    case "folders":
      return api.folders.trash(id, { page });
    case "documents":
      return api.documents.trash(id, { page });
    case "tasks":
      return api.tasks.trash(id, { page });
    case "time":
      return api.timeEntries.trash(id, { page });
    case "finance":
      return api.financialEntries.trash(id, { page });
    case "requests":
      return api.expenseRequests.trash(id, { page });
  }
}

export function useTrashList(projectId: number | null, resource: TrashResource) {
  const query = useInfiniteQuery({
    queryKey: ["trash", resource, projectId ?? "global"],
    queryFn: ({ pageParam }) => fetchTrash(projectId, resource, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (Array.isArray(lastPage)) {
        return undefined;
      }
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    enabled: resource === "projects" || Boolean(projectId),
  });

  const items = (query.data?.pages ?? []).flatMap((page) => normalizeApiList(page));
  const count = getApiCount(query.data?.pages?.[0]);

  return { ...query, items, count };
}

/** Restaurer remet l'element dans les listes actives : on recharge la corbeille et
 * la ressource concernee (l'arbre pour un dossier ou un document, qui les porte
 * tous les deux). */
export function useRestoreTrashItem(projectId: number | null, resource: TrashResource) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number): Promise<unknown> => {
      if (resource === "projects") {
        return api.projects.restore(id);
      }
      const project = projectId!;
      switch (resource) {
        case "folders":
          return api.folders.restore(project, id);
        case "documents":
          return api.documents.restore(project, id);
        case "tasks":
          return api.tasks.restore(project, id);
        case "time":
          return api.timeEntries.restore(project, id);
        case "finance":
          return api.financialEntries.restore(project, id);
        case "requests":
          return api.expenseRequests.restore(project, id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      if (resource === "projects") {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        return;
      }
      const project = projectId!;
      const activeKey = {
        folders: queryKeys.folders.allTree(project),
        documents: queryKeys.folders.allTree(project),
        tasks: queryKeys.tasks.all(project),
        time: queryKeys.timeEntries.all(project),
        finance: queryKeys.financialEntries.all(project),
        requests: queryKeys.expenseRequests.all(project),
      }[resource];
      queryClient.invalidateQueries({ queryKey: activeKey });
    },
  });
}
