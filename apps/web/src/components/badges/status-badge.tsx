import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface BadgeOption {
  label: string;
  icon: LucideIcon;
  className?: string;
}

export function StatusBadge({
  option,
  className,
}: {
  option: BadgeOption;
  className?: string;
}) {
  const Icon = option.icon;
  return (
    <Badge variant="secondary" className={cn("shrink-0", option.className, className)}>
      <Icon className="size-3" />
      {option.label}
    </Badge>
  );
}
