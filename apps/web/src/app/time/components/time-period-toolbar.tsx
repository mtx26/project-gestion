"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSelect, FilterToggle } from "@/components/ui/filter-bar";
import { SelectItem } from "@/components/ui/select";
import type { PaymentStatusFilter, PeriodPreset, UserFilter } from "../lib/time-filters";

export function TimePeriodToolbar({
  canViewAllTime,
  members,
  periodPreset,
  paymentStatusFilter,
  targetFilterLabel,
  targetFolderId,
  userFilter,
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
  userFilter: UserFilter;
  includeUnpaidOutsideMonth: boolean;
  folders: FolderTreeNode[];
  onSelectFolder: (folderId: number | null) => void;
  onPeriodPresetChange: (value: PeriodPreset) => void;
  onPaymentStatusFilterChange: (value: PaymentStatusFilter) => void;
  onUserFilterChange: (value: UserFilter) => void;
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
        <FilterSelect value={userFilter} onValueChange={(value) => onUserFilterChange(value as UserFilter)}>
          <SelectItem value="mine">Mes heures</SelectItem>
          <SelectItem value="all">Tous les membres</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={`member-${member.user}`}>
              {member.user_display_name}
            </SelectItem>
          ))}
        </FilterSelect>
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
        Impayés inclus
      </FilterToggle>
      <FilterClear path="/time" removeKeys={["period", "user", "payment", "target", "include_unpaid"]} />
    </FilterBar>
  );
}
