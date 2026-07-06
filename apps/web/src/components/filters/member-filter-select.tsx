"use client";

import type { ProjectMember } from "@project-gestion/types";
import { SelectItem } from "@/components/ui/select";
import { FilterSelect } from "@/components/filters/filter-bar";

type Member = Pick<ProjectMember, "id" | "user" | "user_display_name">;

interface MemberFilterSelectProps {
  members: Member[];
  value: number | null;
  currentUserId?: number | null;
  selfLabel?: string;
  className?: string;
  onChange: (memberId: number | null) => void;
}

export function MemberFilterSelect({ members, value, currentUserId, selfLabel, className, onChange }: MemberFilterSelectProps) {
  if (members.length === 0) return null;
  return (
    <FilterSelect
      value={value != null ? String(value) : "all"}
      onValueChange={(v) => onChange(v === "all" ? null : Number(v))}
      className={className}
    >
      <SelectItem value="all">Tous les membres</SelectItem>
      {members.map((m) => (
        <SelectItem key={m.id} value={String(m.user)}>
          {currentUserId != null && m.user === currentUserId && selfLabel ? selfLabel : m.user_display_name}
        </SelectItem>
      ))}
    </FilterSelect>
  );
}
