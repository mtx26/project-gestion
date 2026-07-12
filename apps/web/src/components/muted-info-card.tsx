import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Bordered, muted-background container for a compact info/list row (member, invitation, role...). */
export function MutedInfoCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-md border bg-muted/30 p-3 text-sm", className)} {...props} />;
}
