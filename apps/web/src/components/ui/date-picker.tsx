"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? parseISO(value) : undefined;

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          {selected ? (
            format(selected, "d MMMM yyyy", { locale: fr })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
        />
      </PopoverContent>
    </Popover>
  );
}
