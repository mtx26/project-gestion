"use client";

import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Member = { id: number; user: number; user_display_name: string };

export function MemberFilterSelect({
  members,
  value,
  className,
  onChange,
}: {
  members: Member[];
  value: number | null;
  className?: string;
  onChange: (memberId: number | null) => void;
}) {
  if (members.length === 0) return null;
  return (
    <Select
      value={value != null ? String(value) : "all"}
      onValueChange={(v) => onChange(v === "all" ? null : Number(v))}
    >
      <SelectTrigger className={cn("w-full bg-background", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tous les membres</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={String(m.user)}>{m.user_display_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
