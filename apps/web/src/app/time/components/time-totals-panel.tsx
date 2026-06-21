"use client";

import type { TimeEntry } from "@project-gestion/types";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatMoney } from "@/lib/task-utils";

export function TimeSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

export function TimeTotalsPanel({
  label,
  totals,
  entries,
  userNameById,
  currentUserId,
}: {
  label: string;
  totals: { durationMinutes: number; costAmount: number; remainingAmount: number };
  entries: TimeEntry[];
  userNameById: Map<number, string>;
  currentUserId: number | null;
}) {
  const userBreakdown = useMemo(() => {
    const byUser = new Map<number, number>();
    for (const entry of entries) {
      if (entry.user != null) byUser.set(entry.user, (byUser.get(entry.user) ?? 0) + entry.duration_minutes);
    }
    return Array.from(byUser.entries())
      .map(([userId, minutes]) => ({
        name: userId === currentUserId ? "Toi" : (userNameById.get(userId) ?? `Utilisateur ${userId}`),
        minutes,
        isCurrentUser: userId === currentUserId,
      }))
      .sort((a, b) => {
        if (a.isCurrentUser) return -1;
        if (b.isCurrentUser) return 1;
        return a.name.localeCompare(b.name, "fr");
      });
  }, [entries, userNameById, currentUserId]);

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <CardTitle className="mt-1 text-lg">Synthese</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <TimeSummary label="Temps total" value={formatDuration(totals.durationMinutes)} />
          <TimeSummary label="Montant total" value={formatMoney(totals.costAmount)} />
          <TimeSummary label="Reste a payer" value={formatMoney(totals.remainingAmount)} />
        </div>
        {userBreakdown.length > 0 ? (
          <div className="space-y-1.5 border-t pt-3">
            {userBreakdown.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatDuration(row.minutes)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
