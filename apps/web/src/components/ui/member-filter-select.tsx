"use client";

import { SelectItem } from "@/components/ui/select";
import { FilterSelect } from "@/components/ui/filter-bar";

type Member = { id: number; user: number; user_display_name: string };

interface MemberFilterSelectProps {
  members: Member[];
  value: number | null;
  className?: string;
  onChange: (memberId: number | null) => void;
}

export function MemberFilterSelect({ members, value, className, onChange }: MemberFilterSelectProps) {
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
          {m.user_display_name}
        </SelectItem>
      ))}
    </FilterSelect>
  );
}
