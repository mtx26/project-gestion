"use client";

import type { CalendarEvent, CalendarEventKind, Task } from "@project-gestion/types";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import frLocale from "@fullcalendar/core/locales/fr";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getTaskStatusChipClassName } from "@/components/badges/task-status-badge";
import { getPaymentStatusChipClassName, type PaymentStatus } from "@/components/badges/payment-status-badge";

type EventExtendedProps = {
  kind: CalendarEventKind;
  entityId: number;
  status?: Task["status"];
  priority?: Task["priority"];
  payStatus?: PaymentStatus;
  durationLabel?: string;
};

/** Le backend renvoie deja des evenements fusionnes/tries/formates (dates simples,
 * libelles, statut de paiement) — ce composant ne fait plus que les traduire dans
 * le format attendu par FullCalendar. */
function toFullCalendarEvent(e: CalendarEvent) {
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end ?? undefined,
    allDay: true,
    extendedProps: {
      kind: e.kind,
      entityId: e.entity_id,
      status: e.status ?? undefined,
      priority: e.priority ?? undefined,
      payStatus: e.pay_status ?? undefined,
      durationLabel: e.duration_label ?? undefined,
    } satisfies EventExtendedProps,
  };
}

const PRIORITY_DOT: Record<NonNullable<Task["priority"]>, string> = {
  low: "bg-slate-400 dark:bg-slate-500",
  normal: "bg-amber-500",
  high: "bg-red-500",
};

function statusCls(status: Task["status"] | undefined): string {
  return getTaskStatusChipClassName(status ?? "todo");
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
  const { kind, status, priority, payStatus } = arg.event.extendedProps as EventExtendedProps;
  const title = arg.event.title;

  if (kind === "time") {
    return (
      <div className={cn(BASE, getPaymentStatusChipClassName(payStatus ?? "unpaid"))} title={title}>
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

/** Priorise les entrees de temps sur les taches dans le tri d'affichage : sans ca,
 * le tri par defaut de FullCalendar (duree decroissante) relegue une entree d'une
 * journee derriere le lien "+N" des qu'assez de taches multi-jours couvrent la
 * meme date. Le backend renvoie deja les evenements dans cet ordre ; FullCalendar
 * re-trie systematiquement selon `eventOrder`, donc ce n'est pas facultatif. */
function eventOrder(a: unknown, b: unknown): number {
  const rank = (ev: unknown) =>
    ((ev as { extendedProps: EventExtendedProps }).extendedProps.kind === "time" ? 0 : 1);
  return rank(a) - rank(b);
}

export function ProjectCalendarView({
  events: calendarEvents,
  isLoading,
  onDatesChange,
  onTaskClick,
  onTimeClick,
}: {
  events: CalendarEvent[];
  isLoading: boolean;
  onDatesChange?: (start: Date) => void;
  onTaskClick?: (taskId: number) => void;
  onTimeClick?: (timeEntryId: number) => void;
}) {
  const events = useMemo(() => calendarEvents.map(toFullCalendarEvent), [calendarEvents]);

  function handleEventClick(arg: EventClickArg) {
    const { kind, entityId } = arg.event.extendedProps as EventExtendedProps;
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
        eventOrder={eventOrder}
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
