"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Empêche de choisir une date/heure avant cette valeur (ex: la date de début pour un picker de fin). */
  minDate?: string;
  /** Empêche de choisir une date/heure après cette valeur (ex: la date de fin pour un picker de début). */
  maxDate?: string;
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
  disabled,
  minDate,
  maxDate,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Accept both "YYYY-MM-DD", "YYYY-MM-DDTHH:MM" and "YYYY-MM-DDTHH:MM:SSZ" (from API)
  const normalized = value ? value.slice(0, 16) : "";
  const datePart = normalized ? normalized.split("T")[0] : "";
  const timePart = normalized.includes("T") ? normalized.split("T")[1] : "00:00";

  const selected = datePart ? parseISO(datePart) : undefined;

  const normalizedMin = minDate ? minDate.slice(0, 16) : "";
  const normalizedMax = maxDate ? maxDate.slice(0, 16) : "";
  const minDatePart = normalizedMin ? normalizedMin.split("T")[0] : "";
  const maxDatePart = normalizedMax ? normalizedMax.split("T")[0] : "";
  const minDateObj = minDatePart ? parseISO(minDatePart) : undefined;
  const maxDateObj = maxDatePart ? parseISO(maxDatePart) : undefined;
  const timeMin = minDatePart && minDatePart === datePart ? normalizedMin.split("T")[1] : undefined;
  const timeMax = maxDatePart && maxDatePart === datePart ? normalizedMax.split("T")[1] : undefined;

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      let time = timePart;
      const newDatePart = format(date, "yyyy-MM-dd");
      if (minDatePart && newDatePart === minDatePart && normalizedMin.split("T")[1] > time) {
        time = normalizedMin.split("T")[1];
      }
      if (maxDatePart && newDatePart === maxDatePart && normalizedMax.split("T")[1] < time) {
        time = normalizedMax.split("T")[1];
      }
      onChange(`${newDatePart}T${time}`);
    } else {
      onChange("");
    }
    setOpen(false);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!datePart) return;
    onChange(`${datePart}T${e.target.value}`);
  }

  function handleTimeBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!datePart || !e.target.value) return;
    let time = e.target.value;
    if (timeMin && time < timeMin) time = timeMin;
    if (timeMax && time > timeMax) time = timeMax;
    if (time !== e.target.value) onChange(`${datePart}T${time}`);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !datePart && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4 shrink-0" />
            {selected ? (
              format(selected, "d MMM yyyy", { locale: fr })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleDateSelect}
            defaultMonth={selected}
            disabled={(date) => {
              if (minDateObj && date < minDateObj) return true;
              if (maxDateObj && date > maxDateObj) return true;
              return false;
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timePart}
        onChange={handleTimeChange}
        onBlur={handleTimeBlur}
        min={timeMin}
        max={timeMax}
        disabled={disabled || !datePart}
        className="w-[7.5rem] appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  );
}
