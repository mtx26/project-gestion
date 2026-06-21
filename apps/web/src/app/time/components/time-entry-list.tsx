"use client";

import type { TimeEntry } from "@project-gestion/types";
import { CreditCard, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { TargetIcon } from "@/components/ui/target-tree-picker";
import { formatDateTime } from "@/lib/date-utils";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import {
  getEntryTargetLabel,
  getPaymentStatus,
  getTimeEntryCardClassName,
} from "../lib/time-filters";

export function TimeEntryList({
  entries,
  isLoading,
  userNameById,
  folderNameById,
  taskTitleById,
  canPay,
  canEdit,
  canDelete,
  deletingId,
  onPay,
  onEdit,
  onDetail,
  onDelete,
}: {
  entries: TimeEntry[];
  isLoading: boolean;
  userNameById: Map<number, string>;
  folderNameById: Map<number, string>;
  taskTitleById: Map<number, string>;
  canPay: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  onPay: (entry: TimeEntry) => void;
  onEdit: (entry: TimeEntry) => void;
  onDetail: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <SkeletonLoader count={3} className="h-24 rounded-md" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Empty className="border p-8">
        <EmptyHeader>
          <EmptyTitle>Aucune entree</EmptyTitle>
          <EmptyDescription>Aucun temps enregistre pour cette vue.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <TimeEntryRow
          key={entry.id}
          entry={entry}
          displayName={userNameById.get(entry.user) ?? entry.user_display_name}
          targetLabel={getEntryTargetLabel(entry, folderNameById, taskTitleById)}
          canPay={canPay}
          canEdit={canEdit}
          canDelete={canDelete}
          isDeleting={deletingId === entry.id}
          onPay={() => onPay(entry)}
          onEdit={() => onEdit(entry)}
          onDetail={() => onDetail(entry)}
          onDelete={() => onDelete(entry)}
        />
      ))}
    </div>
  );
}

function TimeEntryRow({
  entry,
  displayName,
  targetLabel,
  canPay,
  canEdit,
  canDelete,
  isDeleting,
  onPay,
  onEdit,
  onDetail,
  onDelete,
}: {
  entry: TimeEntry;
  displayName: string;
  targetLabel: string;
  canPay: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onPay: () => void;
  onEdit: () => void;
  onDetail: () => void;
  onDelete: () => void;
}) {
  const paymentStatus = getPaymentStatus(entry);
  const targetType = entry.task != null ? "task" : entry.folder != null ? "folder" : "project";

  return (
    <div className={getTimeEntryCardClassName(paymentStatus)}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 cursor-pointer space-y-1" onClick={onDetail}>
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={paymentStatus} />
            <p className="min-w-0 font-medium">{entry.description || "Temps enregistre"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{displayName}</span>
            <span>{formatDateTime(entry.created_at)}</span>
            <span className="inline-flex max-w-full items-center gap-1">
              <TargetIcon type={targetType} />
              <span className="min-w-0 truncate">{targetLabel}</span>
            </span>
            <span className="font-medium text-foreground">{formatDuration(entry.duration_minutes)}</span>
            <span className="font-medium text-foreground">{formatMoney(entry.cost_amount)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canPay && paymentStatus !== "paid" ? (
            <Button type="button" variant="outline" size="sm" onClick={onPay}>
              <CreditCard className="size-4" />
              Payer
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Voir les details" onClick={onDetail}>
            <Eye className="size-4" />
          </Button>
          {canEdit ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifier cette entree" onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer cette entree" disabled={isDeleting} onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
