"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import type { TreePickerProps } from "@/components/ui/tree-picker";
import { TreePickerDialog } from "@/components/ui/tree-picker";
import { buildClearParams } from "@/lib/url-params";

// ─── FilterBar ──────────────────────────────────────────────────────────────

export function FilterBar({ className, children }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-nowrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── FilterSelect ───────────────────────────────────────────────────────────

interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function FilterSelect({ value, onValueChange, className, children }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-full bg-background sm:flex-1 sm:min-w-0", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

// ─── FilterSearch ───────────────────────────────────────────────────────────

interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FilterSearch({ value, onChange, placeholder = "Rechercher…", className }: FilterSearchProps) {
  return (
    <InputGroup className={cn("bg-background sm:flex-1 sm:min-w-0", className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

// ─── FilterToggle ───────────────────────────────────────────────────────────

interface FilterToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function FilterToggle({ pressed, onPressedChange, children, className }: FilterToggleProps) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className={cn("shrink-0", className)}
    >
      {children}
    </Toggle>
  );
}

// ─── FilterClear ────────────────────────────────────────────────────────────

interface FilterClearProps {
  path: string;
  removeKeys: string[];
  onClick?: () => void;
  className?: string;
}

export function FilterClear({ path, removeKeys, onClick, className }: FilterClearProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick() {
    onClick?.();
    const params = buildClearParams(searchParams, removeKeys);
    router.replace(`${path}?${params.toString()}`, { scroll: false });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={handleClick}
    >
      Effacer filtres
    </Button>
  );
}

// ─── FilterFolderPicker ─────────────────────────────────────────────────────

type FilterFolderPickerProps = Omit<Extract<TreePickerProps, { mode: "folder" }>, "mode"> & {
  className?: string;
};

export function FilterFolderPicker({ className, ...props }: FilterFolderPickerProps) {
  return (
    <div className={cn("w-full sm:flex-1 sm:min-w-0", className)}>
      <TreePickerDialog mode="folder" {...props} />
    </div>
  );
}
