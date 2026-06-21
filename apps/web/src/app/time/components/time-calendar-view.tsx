"use client";

import type { TimeEntry } from "@project-gestion/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { formatCalendarMonth, formatTimeOnly } from "@/lib/date-utils";
import { formatDuration } from "@/lib/task-utils";
import {
  formatDateInputValue,
  getCalendarMonthDate,
  getEntryTargetLabel,
  getMonthCalendarDays,
  groupTimeEntriesByDay,
  summarizeTimeEntries,
} from "../lib/time-filters";

export function TimeCalendarView({
  entries,
  isLoading,
  userNameById,
  folderNameById,
  taskTitleById,
  calendarDate,
}: {
  entries: TimeEntry[];
  isLoading: boolean;
  userNameById: Map<number, string>;
  folderNameById: Map<number, string>;
  taskTitleById: Map<number, string>;
  calendarDate?: string;
}) {
  const [localMonthDate, setLocalMonthDate] = useState<Date | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-7 gap-0 rounded-lg border bg-card">
        <SkeletonLoader count={35} className="m-2 h-28 rounded-md" />
      </div>
    );
  }

  const baseMonthDate = getCalendarMonthDate(calendarDate, entries);
  const monthDate = localMonthDate ?? baseMonthDate;
  const days = getMonthCalendarDays(monthDate);
  const entriesByDay = groupTimeEntriesByDay(entries);

  function goToPrevMonth() {
    setLocalMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setLocalMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <p className="font-medium">{formatCalendarMonth(monthDate)}</p>
          <p className="text-xs text-muted-foreground">{entries.length} entree{entries.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Mois precedent" onClick={goToPrevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Mois suivant" onClick={goToNextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="border-r p-2 last:border-r-0">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dateKey = formatDateInputValue(day);
          const dayEntries = entriesByDay.get(dateKey) ?? [];
          const dayTotals = summarizeTimeEntries(dayEntries);
          const isOutsideMonth = day.getMonth() !== monthDate.getMonth();

          return (
            <div
              key={`${dateKey}-${index}`}
              className={`min-h-36 border-r border-b p-2 ${index % 7 === 6 ? "border-r-0" : ""} ${isOutsideMonth ? "bg-muted/20 text-muted-foreground" : "bg-card"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{day.getDate()}</span>
                {dayEntries.length > 0 ? (
                  <span className="text-xs text-muted-foreground">{formatDuration(dayTotals.durationMinutes)}</span>
                ) : null}
              </div>
              <div className="space-y-1">
                {dayEntries.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{entry.description || getEntryTargetLabel(entry, folderNameById, taskTitleById)}</span>
                      <span className="shrink-0">{formatTimeOnly(entry.created_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {(entry.user != null ? userNameById.get(entry.user) : null) ?? entry.user_display_name}
                    </div>
                  </div>
                ))}
                {dayEntries.length > 4 ? (
                  <p className="text-xs text-muted-foreground">+ {dayEntries.length - 4} autres</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
