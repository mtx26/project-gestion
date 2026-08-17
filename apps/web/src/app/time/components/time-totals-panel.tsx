"use client";

import type { TimeEntryUserStats } from "@project-gestion/types";
import { CreditCard } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
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
  byUser,
  userNameById,
  currentUserId,
  onPay,
}: {
  label: string;
  totals: { durationMinutes: number; costAmount: number; remainingAmount: number };
  byUser: TimeEntryUserStats[];
  userNameById: Map<number, string>;
  currentUserId: number | null;
  /** Paiement groupe du "reste a payer" affiche ici — omis sans `time_entry.pay`. */
  onPay?: () => void;
}) {
  const userBreakdown = useMemo(() => {
    return byUser
      .map((row) => ({
        name:
          row.user == null
            ? "Non attribue"
            : row.user === currentUserId
              ? "Toi"
              : (userNameById.get(row.user) ?? `Utilisateur ${row.user}`),
        minutes: row.duration_minutes,
        remainingAmount: Number(row.remaining_amount),
        isCurrentUser: row.user != null && row.user === currentUserId,
      }))
      .sort((a, b) => {
        if (a.isCurrentUser) return -1;
        if (b.isCurrentUser) return 1;
        return a.name.localeCompare(b.name, "fr");
      });
  }, [byUser, userNameById, currentUserId]);

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
        {onPay ? (
          <Button
            type="button"
            className="w-full gap-2"
            disabled={totals.remainingAmount <= 0}
            onClick={onPay}
          >
            <CreditCard className="size-4" />
            Payer
          </Button>
        ) : null}
        {userBreakdown.length > 0 ? (
          <div className="space-y-1.5 border-t pt-3">
            {userBreakdown.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatDuration(row.minutes)} · {formatMoney(row.remainingAmount)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
