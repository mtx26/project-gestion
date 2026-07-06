import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";

export async function invalidateFolders(queryClient: QueryClient, projectId: number): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.folders.allTree(projectId) });
}
