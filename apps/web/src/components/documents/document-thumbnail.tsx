"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentThumbnailProps {
  projectId: number;
  documentId: number;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/** Fetches a short-lived download URL on demand and renders it as an image thumbnail. */
export function DocumentThumbnail({ projectId, documentId, alt, className, fallback }: DocumentThumbnailProps) {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.documents.download(projectId, documentId),
    queryFn: () => api.documents.download(projectId, documentId),
    staleTime: 4 * 60 * 1000,
  });

  if (isPending) {
    return <Skeleton className={cn("size-full rounded-none", className)} />;
  }

  if (isError || !data) {
    return <>{fallback}</>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data.url} alt={alt} className={cn("size-full object-cover", className)} />;
}
