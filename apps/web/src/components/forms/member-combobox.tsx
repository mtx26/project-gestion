"use client";

import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export interface ComboboxMember {
  user: number;
  user_display_name: string;
}

export function MemberCombobox({
  members,
  value,
  onChange,
  placeholder = "Assigner des membres...",
}: {
  members: ComboboxMember[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? members.filter((m) => m.user_display_name.toLowerCase().includes(search.toLowerCase()))
    : members;

  function toggle(userId: number) {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
    setSearch("");
    inputRef.current?.focus();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverAnchor asChild>
        <div
          className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 cursor-text"
          onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        >
          {value.map((uid) => {
            const member = members.find((m) => m.user === uid);
            if (!member) return null;
            return (
              <span
                key={uid}
                className="flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
              >
                {member.user_display_name}
                <button
                  type="button"
                  aria-label={`Retirer ${member.user_display_name}`}
                  className="opacity-50 hover:opacity-100 focus:outline-none"
                  onClick={(e) => { e.stopPropagation(); toggle(uid); }}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !search && value.length > 0) onChange(value.slice(0, -1));
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-16 flex-1 bg-transparent outline-none"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) gap-0 p-1"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Aucun membre trouve.</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.user}
              type="button"
              className="relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pl-1.5 pr-8 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle(m.user)}
            >
              <span className="flex-1 text-left">{m.user_display_name}</span>
              {value.includes(m.user) ? <Check className="absolute right-2 size-4" /> : null}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
