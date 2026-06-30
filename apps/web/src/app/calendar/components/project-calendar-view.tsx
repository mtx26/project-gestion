"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import frLocale from "@fullcalendar/core/locales/fr";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

type PayStatus = "paid" | "partial" | "unpaid";
type EventKind = "time" | "task-span" | "task-point-start" | "task-point-due";

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  extendedProps: {
    kind: EventKind;
    entityId: number;
    status?: Task["status"];
    priority?: Task["priority"];
    payStatus?: PayStatus;
    durationLabel?: string;
  };
};

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDurationShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function getPayStatus(entry: TimeEntry): PayStatus {
  if (Number(entry.remaining_amount) <= 0) return "paid";
  if (Number(entry.paid_amount) > 0) return "partial";
  return "unpaid";
}

function buildEvents(timeEntries: TimeEntry[], tasks: Task[]): CalEvent[] {
  const events: CalEvent[] = [];

  for (const e of timeEntries) {
    const dateStr = e.created_at.slice(0, 10);
    const durationLabel = formatDurationShort(e.duration_minutes);
    const label = [durationLabel, e.description || e.user_display_name].filter(Boolean).join(" · ");
    events.push({
      id: `time-${e.id}`,
      title: label,
      start: dateStr,
      allDay: true,
      extendedProps: { kind: "time", entityId: e.id, payStatus: getPayStatus(e), durationLabel },
    });
  }

  for (const t of tasks) {
    const base = { entityId: t.id, status: t.status, priority: t.priority };
    if (t.start_date && t.end_date) {
      events.push({
        id: `task-${t.id}`,
        title: t.title,
        start: t.start_date,
        end: addOneDay(t.end_date),
        allDay: true,
        extendedProps: { kind: "task-span", ...base },
      });
    } else if (t.start_date) {
      events.push({ id: `task-start-${t.id}`, title: t.title, start: t.start_date, allDay: true, extendedProps: { kind: "task-point-start", ...base } });
    } else if (t.end_date) {
      events.push({ id: `task-due-${t.id}`, title: t.title, start: t.end_date, allDay: true, extendedProps: { kind: "task-point-due", ...base } });
    }
  }

  return events;
}

/* Couleurs identiques aux StatusBadge de l'app */
const STATUS_CLASSES: Record<NonNullable<Task["status"]>, string> = {
  todo: "bg-secondary text-secondary-foreground",
  in_progress: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const PRIORITY_DOT: Record<NonNullable<Task["priority"]>, string> = {
  low: "bg-slate-400 dark:bg-slate-500",
  normal: "bg-amber-500",
  high: "bg-red-500",
};

const PAY_CLASSES: Record<PayStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  unpaid: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

function statusCls(status: Task["status"] | undefined): string {
  return STATUS_CLASSES[status ?? "todo"];
}

const BASE = "flex items-center gap-1 w-full overflow-hidden rounded px-1.5 py-px text-[11px] font-medium leading-5 cursor-pointer";

function PriorityDot({ priority }: { priority?: Task["priority"] }) {
  return (
    <span
      className={cn("inline-block size-1.5 shrink-0 rounded-full", PRIORITY_DOT[priority ?? "normal"])}
    />
  );
}

function EventChip({ arg }: { arg: EventContentArg }) {
  const { kind, status, priority, payStatus } = arg.event.extendedProps as CalEvent["extendedProps"];
  const title = arg.event.title;

  if (kind === "time") {
    return (
      <div className={cn(BASE, PAY_CLASSES[payStatus ?? "unpaid"])} title={title}>
        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
        <span className="min-w-0 truncate">{title}</span>
      </div>
    );
  }

  if (kind === "task-span") {
    return (
      <div className={cn(BASE, statusCls(status))} title={title}>
        <PriorityDot priority={priority} />
        <span className="min-w-0 truncate">{title}</span>
      </div>
    );
  }

  if (kind === "task-point-start") {
    return (
      <div className={cn(BASE, statusCls(status))} title={title}>
        <PriorityDot priority={priority} />
        <span className="shrink-0 opacity-70 text-[10px]">↦</span>
        <span className="min-w-0 truncate">{title}</span>
      </div>
    );
  }

  return (
    <div className={cn(BASE, statusCls(status))} title={title}>
      <PriorityDot priority={priority} />
      <span className="shrink-0 opacity-70 text-[10px]">⚑</span>
      <span className="min-w-0 truncate">{title}</span>
    </div>
  );
}

export function ProjectCalendarView({
  timeEntries,
  tasks,
  isLoading,
  onDatesChange,
  onTaskClick,
  onTimeClick,
}: {
  timeEntries: TimeEntry[];
  tasks: Task[];
  isLoading: boolean;
  onDatesChange?: (start: Date) => void;
  onTaskClick?: (taskId: number) => void;
  onTimeClick?: (timeEntryId: number) => void;
}) {
  const events = useMemo(() => buildEvents(timeEntries, tasks), [timeEntries, tasks]);

  function handleEventClick(arg: EventClickArg) {
    const { kind, entityId } = arg.event.extendedProps as CalEvent["extendedProps"];
    if (kind === "time") {
      onTimeClick?.(entityId);
    } else {
      onTaskClick?.(entityId);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {isLoading ? (
        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Chargement...
        </div>
      ) : null}
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        locale={frLocale}
        events={events}
        height="auto"
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        eventContent={(arg) => <EventChip arg={arg} />}
        eventDisplay="block"
        displayEventTime={false}
        dayMaxEvents={4}
        datesSet={(info) => onDatesChange?.(info.start)}
        eventClick={handleEventClick}
      />
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-950" />
          En cours
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-secondary ring-1 ring-inset ring-border" />
          A faire
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-50 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950" />
          Terminee
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-50 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950" />
          Temps paye
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-950" />
          Temps partiel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-50 ring-1 ring-inset ring-orange-200 dark:bg-orange-950" />
          Temps a payer
        </span>
      </div>
    </div>
  );
}
