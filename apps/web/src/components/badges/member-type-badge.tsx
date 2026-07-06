import { AlertTriangle, Crown, User } from "lucide-react";
import { StatusBadge, type BadgeOption } from "./status-badge";

type MemberType = "owner" | "role_deleted" | "member";

const OPTIONS: Record<MemberType, BadgeOption> = {
  owner: {
    label: "Proprietaire",
    icon: Crown,
    className: "bg-primary/10 text-primary dark:bg-primary/20",
  },
  role_deleted: {
    label: "Sans role",
    icon: AlertTriangle,
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  member: {
    label: "Membre",
    icon: User,
  },
};

export function MemberTypeBadge({
  isOwner,
  roleDeleted = false,
  className,
}: {
  isOwner: boolean;
  roleDeleted?: boolean;
  className?: string;
}) {
  const type: MemberType = isOwner ? "owner" : roleDeleted ? "role_deleted" : "member";
  return <StatusBadge option={OPTIONS[type]} className={className} />;
}
