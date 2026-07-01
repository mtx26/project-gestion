"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type PeriodPreset, detectPreset, getPeriodLabel, getPeriodRange } from "@/lib/period-utils";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Toutes dates" },
  { value: "this-week", label: "Cette semaine" },
  { value: "this-month", label: "Ce mois" },
  { value: "last-month", label: "Mois dernier" },
  { value: "last-30-days", label: "30 derniers jours" },
  { value: "this-year", label: "Cette année" },
];

type InternalMode = PeriodPreset | "custom";

function presetToRange(preset: PeriodPreset): DateRange | undefined {
  if (preset === "all") return undefined;
  const { startDate, endDate } = getPeriodRange(preset);
  if (!startDate) return undefined;
  return {
    from: new Date(startDate + "T00:00:00"),
    to: endDate ? new Date(endDate + "T00:00:00") : undefined,
  };
}

function toDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export interface FilterPeriodPickerProps {
  /** Date de début actuelle (YYYY-MM-DD, depuis l'URL). */
  dateFrom?: string;
  /** Date de fin actuelle (YYYY-MM-DD, depuis l'URL). */
  dateTo?: string;
  /** Appelé à la confirmation avec les dates réelles (jamais un nom de preset). */
  onChange: (value: { date_from: string | null; date_to: string | null }) => void;
  className?: string;
}

export function FilterPeriodPicker({
  dateFrom,
  dateTo,
  onChange,
  className,
}: FilterPeriodPickerProps) {
  const detectedPreset = detectPreset(dateFrom, dateTo);
  const isActive = Boolean(dateFrom);

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<InternalMode>("all");
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);

  function handleOpenChange(next: boolean) {
    if (next) {
      if (detectedPreset === "custom") {
        setMode("custom");
        setRange({
          from: dateFrom ? new Date(dateFrom + "T00:00:00") : undefined,
          to: dateTo ? new Date(dateTo + "T00:00:00") : undefined,
        });
      } else {
        setMode(detectedPreset);
        setRange(presetToRange(detectedPreset));
      }
    }
    setOpen(next);
  }

  function handlePresetClick(p: PeriodPreset) {
    setMode(p);
    setRange(presetToRange(p));
  }

  function handleRangeSelect(r: DateRange | undefined) {
    setRange(r);
    setMode("custom");
  }

  function handleApply() {
    // Ferme d'abord la popover, puis declenche le changement d'URL au tick suivant :
    // sinon la navigation Next.js (router.replace dans onChange) peut re-render
    // pendant la fermeture de la Dialog Radix et provoquer un clignotement
    // ferme/rouvre/ferme.
    setOpen(false);
    const applyChange = () => {
      if (mode === "all") {
        onChange({ date_from: null, date_to: null });
      } else if (mode === "custom") {
        onChange({
          date_from: range?.from ? toDateStr(range.from) : null,
          date_to: range?.to ? toDateStr(range.to) : null,
        });
      } else {
        const { startDate, endDate } = getPeriodRange(mode);
        onChange({ date_from: startDate ?? null, date_to: endDate ?? null });
      }
    };
    setTimeout(applyChange, 0);
  }

  // Label du bouton déclencheur
  let label: string;
  if (!dateFrom) {
    label = "Toutes dates";
  } else if (detectedPreset !== "custom") {
    label = getPeriodLabel(detectedPreset);
  } else {
    const from = format(new Date(dateFrom + "T00:00:00"), "dd/MM/yy");
    const to = dateTo ? format(new Date(dateTo + "T00:00:00"), "dd/MM/yy") : "…";
    label = `${from} – ${to}`;
  }

  const calendarDefaultMonth =
    range?.from ??
    (mode !== "all" && mode !== "custom" ? presetToRange(mode)?.from : undefined) ??
    new Date();

  // Résumé affiché dans le pied de dialog
  let footerLabel: string;
  if (mode === "all") {
    footerLabel = "Aucune période sélectionnée";
  } else if (mode === "custom") {
    if (range?.from) {
      footerLabel = range.to
        ? `${format(range.from, "dd MMM yyyy", { locale: fr })} – ${format(range.to, "dd MMM yyyy", { locale: fr })}`
        : `À partir du ${format(range.from, "dd MMM yyyy", { locale: fr })}`;
    } else {
      footerLabel = "Choisissez une plage sur le calendrier";
    }
  } else {
    footerLabel = getPeriodLabel(mode);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-fit gap-2 bg-background px-3 font-normal",
            isActive && "border-primary/60 text-primary",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Période</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Presets */}
          <div className="flex flex-row flex-wrap gap-1 sm:w-44 sm:shrink-0 sm:flex-col sm:gap-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePresetClick(p.value)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted sm:w-full",
                  mode === p.value && "bg-primary/10 font-medium text-primary",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setMode("custom"); setRange(undefined); }}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted sm:w-full",
                mode === "custom" && "bg-primary/10 font-medium text-primary",
              )}
            >
              Personnalisé
            </button>
          </div>

          {/* Calendrier */}
          <div className="flex-1 overflow-x-auto sm:border-l sm:pl-4">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              defaultMonth={calendarDefaultMonth}
              numberOfMonths={2}
              locale={fr}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">{footerLabel}</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={handleApply}>
              Appliquer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
