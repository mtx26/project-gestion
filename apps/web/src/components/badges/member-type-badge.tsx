import { AlertTriangle, Crown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type MemberTypeBadgeProps = {
  isOwner: boolean;
  roleDeleted?: boolean;
  className?: string;
};

export function MemberTypeBadge({ isOwner, roleDeleted = false, className }: MemberTypeBadgeProps) {
  if (isOwner) {
    return (
      <Badge variant="secondary" className={cn("shrink-0 bg-primary/10 text-primary dark:bg-primary/20", className)}>
        <Crown className="size-3" />
        Proprietaire
      </Badge>
    );
  }
  if (roleDeleted) {
    return (
      <Badge variant="secondary" className={cn("shrink-0 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", className)}>
        <AlertTriangle className="size-3" />
        Sans role
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn("shrink-0", className)}>
      <User className="size-3" />
      Membre
    </Badge>
  );
}
