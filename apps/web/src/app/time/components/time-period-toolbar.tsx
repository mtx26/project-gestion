"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSelect, FilterToggle } from "@/components/filters/filter-bar";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { SelectItem } from "@/components/ui/select";
import type { PaymentStatusFilter, PeriodPreset } from "../lib/time-filters";

export function TimePeriodToolbar({
  canViewAllTime,
  members,
  periodPreset,
  paymentStatusFilter,
  targetFilterLabel,
  targetFolderId,
  currentUserId,
  userFilterId,
  includeUnpaidOutsideMonth,
  folders,
  onSelectFolder,
  onPeriodPresetChange,
  onPaymentStatusFilterChange,
  onUserFilterChange,
  onIncludeUnpaidOutsideMonthChange,
  onCreateFolder,
}: {
  canViewAllTime: boolean;
  members: Array<{ id: number; user: number; user_display_name: string }>;
  periodPreset: PeriodPreset;
  paymentStatusFilter: PaymentStatusFilter;
  targetFilterLabel: string | null;
  targetFolderId: number | null;
  currentUserId: number | null;
  userFilterId: number | null;
  includeUnpaidOutsideMonth: boolean;
  folders: FolderTreeNode[];
  onSelectFolder: (folderId: number | null) => void;
  onPeriodPresetChange: (value: PeriodPreset) => void;
  onPaymentStatusFilterChange: (value: PaymentStatusFilter) => void;
  onUserFilterChange: (userId: number | null) => void;
  onIncludeUnpaidOutsideMonthChange: (value: boolean) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
}) {
  const folderPickerLabel = targetFilterLabel ?? "Tous dossiers";

  return (
    <FilterBar>
      <FilterSelect value={periodPreset} onValueChange={(value) => onPeriodPresetChange(value as PeriodPreset)}>
        <SelectItem value="this-week">Cette semaine</SelectItem>
        <SelectItem value="this-month">Ce mois</SelectItem>
        <SelectItem value="last-month">Mois dernier</SelectItem>
        <SelectItem value="last-30-days">30 derniers jours</SelectItem>
        <SelectItem value="this-year">Cette année</SelectItem>
        <SelectItem value="all">Tout</SelectItem>
      </FilterSelect>
      {canViewAllTime ? (
        <MemberFilterSelect
          members={members}
          value={userFilterId}
          currentUserId={currentUserId}
          selfLabel="Mes heures"
          onChange={onUserFilterChange}
        />
      ) : null}
      <FilterFolderPicker
        folders={folders}
        selectedFolderId={targetFolderId}
        buttonLabel={folderPickerLabel}
        description="Filtrer les entrées de temps par dossier."
        onSelect={onSelectFolder}
        onCreateFolder={onCreateFolder}
      />
      <FilterSelect value={paymentStatusFilter} onValueChange={(value) => onPaymentStatusFilterChange(value as PaymentStatusFilter)}>
        <SelectItem value="all">Tous statuts</SelectItem>
        <SelectItem value="unpaid">À payer</SelectItem>
        <SelectItem value="partial">Partiel</SelectItem>
        <SelectItem value="paid">Payé</SelectItem>
      </FilterSelect>
      <FilterToggle
        pressed={includeUnpaidOutsideMonth}
        onPressedChange={onIncludeUnpaidOutsideMonthChange}
      >
        Impayés hors période
      </FilterToggle>
      <FilterClear path="/time" removeKeys={["period", "user", "payment", "target", "include_unpaid", "page"]} />
    </FilterBar>
  );
}
