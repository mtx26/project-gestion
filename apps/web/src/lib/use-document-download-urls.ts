"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { api } from "@/lib/api";

/** Resolves download URLs for a batch of documents in a single request, avoiding one query per thumbnail. */
export function useDocumentDownloadUrls(projectId: number, documentIds: number[]) {
  const query = useQuery({
    queryKey: queryKeys.documents.downloadBatch(projectId, documentIds),
    queryFn: () => api.documents.downloadBatch(projectId, documentIds),
    enabled: documentIds.length > 0,
    staleTime: 4 * 60 * 1000,
  });

  const urls = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of query.data ?? []) map.set(item.id, item.url);
    return map;
  }, [query.data]);

  return { urls, isLoading: documentIds.length > 0 && query.isLoading };
}
