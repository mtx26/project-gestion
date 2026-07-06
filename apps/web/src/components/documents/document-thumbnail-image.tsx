import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentThumbnailImageProps {
  url: string | undefined;
  isLoading: boolean;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/** Presentational thumbnail — renders a URL already resolved by a batched query (see useDocumentDownloadUrls). */
export function DocumentThumbnailImage({ url, isLoading, alt, className, fallback }: DocumentThumbnailImageProps) {
  if (isLoading) {
    return <Skeleton className={cn("size-full rounded-none", className)} />;
  }

  if (!url) {
    return <>{fallback}</>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cn("size-full object-cover", className)} />;
}
