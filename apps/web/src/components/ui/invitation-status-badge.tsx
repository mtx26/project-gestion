import { Clock, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function InvitationStatusBadge({ status, className }: { status: string; className?: string }) {
  if (status === "accepted") {
    return (
      <Badge variant="secondary" className={cn("shrink-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", className)}>
        <MailCheck className="size-3" />
        Acceptée
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn("shrink-0 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300", className)}>
      <Clock className="size-3" />
      Invitation
    </Badge>
  );
}
