import { Clock, MailCheck } from "lucide-react";
import { StatusBadge, type BadgeOption } from "./status-badge";

const OPTIONS: Record<string, BadgeOption> = {
  accepted: { label: "Acceptée",   icon: MailCheck, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pending:  { label: "Invitation", icon: Clock,     className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
};

export function InvitationStatusBadge({ status, className }: { status: string; className?: string }) {
  const option = OPTIONS[status] ?? OPTIONS.pending;
  return <StatusBadge option={option} className={className} />;
}
