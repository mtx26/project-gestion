"use client";

import type { ProjectMember } from "@project-gestion/types";
import { SelectItem } from "@/components/ui/select";
import { FilterSelect } from "@/components/filters/filter-bar";

type Member = Pick<ProjectMember, "id" | "user" | "user_display_name">;

interface MemberFilterSelectProps {
  members: Member[];
  value: number | "none" | null;
  currentUserId?: number | null;
  selfLabel?: string;
  /** Ajoute une option pour les enregistrements sans titulaire (`"none"`), quand la
   * ressource filtree peut en avoir — les entrees de temps d'un compte supprime, par
   * exemple. Omis, l'option n'apparait pas. */
  unassignedLabel?: string;
  className?: string;
  onChange: (memberId: number | "none" | null) => void;
}

export function MemberFilterSelect({ members, value, currentUserId, selfLabel, unassignedLabel, className, onChange }: MemberFilterSelectProps) {
  if (members.length === 0) return null;
  return (
    <FilterSelect
      value={value != null ? String(value) : "all"}
      onValueChange={(v) => onChange(v === "all" ? null : v === "none" ? "none" : Number(v))}
      className={className}
    >
      <SelectItem value="all">Tous les membres</SelectItem>
      {members.map((m) => (
        <SelectItem key={m.id} value={String(m.user)}>
          {currentUserId != null && m.user === currentUserId && selfLabel ? selfLabel : m.user_display_name}
        </SelectItem>
      ))}
      {unassignedLabel ? <SelectItem value="none">{unassignedLabel}</SelectItem> : null}
    </FilterSelect>
  );
}
