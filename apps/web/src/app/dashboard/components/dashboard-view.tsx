"use client";

import type { DayEntryPayload, Project } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import { buildTasksListQuery, getApiCount, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3, Plus, Users, WalletCards } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Badge } from "@/components/ui/badge";
import { InvitationStatusBadge } from "@/components/badges/invitation-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DayEntryFormDialog } from "@/app/tasks/components/day-entry-dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberAvatar } from "@/components/member-avatar";
import { MemberTypeBadge } from "@/components/badges/member-type-badge";
import { MutedInfoCard } from "@/components/muted-info-card";
import { NoProjectState } from "@/components/states/no-project-state";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { financeChartConfig, formatFinancePeriod } from "@/lib/finance-chart-utils";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { useProjectResources } from "@/lib/use-project-resources";

interface DashboardViewProps {
  project: Project | null;
  userId: number | null;
  isLoading: boolean;
  onCreateProject: () => void;
}


export function DashboardView({
  project,
  userId,
  isLoading,
  onCreateProject,
}: DashboardViewProps) {
  const { can } = useProjectPermissions(project, userId);
  const canViewMembers = can(permissionCodes.memberView);
  const canViewFinance = can(permissionCodes.financeView);
  const canViewFiles = can(permissionCodes.fileView);
  const canViewTasks = can(permissionCodes.taskView);
  const canEditTasks = can(permissionCodes.taskEdit);
  const canRecordTime = can(permissionCodes.timeEntryEdit);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewAllTime = can(permissionCodes.timeEntryViewAll);
  const canPayTime = can(permissionCodes.timeEntryPay);
  const defaultTimeUserFilter = canViewAllTime && canPayTime ? "all" : "mine";
  const [dayEntryDialogOpen, setDayEntryDialogOpen] = useState(false);
  const { folders, members, handleCreateFolder } = useProjectResources(project?.id ?? null, {
    canView: canViewFiles,
    canEdit: canEditTasks,
    canFetchMembers: canViewMembers,
  });
  const invitationsQuery = useQuery({
    queryKey: project ? queryKeys.invitations.all(project.id) : queryKeys.disabled(),
    queryFn: () => api.invitations.list(project!.id),
    enabled: Boolean(project && canViewMembers),
  });
  // Same range as the finance page's default (current calendar year) so the
  // two show the same figures instead of this one trailing an unbounded,
  // unfiltered all-time window.
  const currentYear = new Date().getFullYear();
  const financeChartStartDate = `${currentYear}-01-01`;
  const financeChartEndDate = `${currentYear}-12-31`;
  const financeQuery = useQuery({
    queryKey: project
      ? queryKeys.financialEntries.chart(project.id, "month", financeChartStartDate, financeChartEndDate)
      : queryKeys.disabled(),
    queryFn: () =>
      api.financialEntries.chart(project!.id, {
        group_by: "month",
        start_date: financeChartStartDate,
        end_date: financeChartEndDate,
      }),
    enabled: Boolean(project && canViewFinance),
  });
  const timeStatsQuery = useQuery({
    queryKey: project
      ? queryKeys.timeEntries.stats(project.id, {
          userId: defaultTimeUserFilter === "all" ? "all" : userId ?? undefined,
          paymentStatus: "not_paid",
        })
      : queryKeys.disabled(),
    queryFn: () => api.timeEntries.stats(project!.id, {
      ...(defaultTimeUserFilter === "all" || userId == null ? {} : { user: userId }),
      payment_status: "not_paid",
    }),
    enabled: Boolean(project && canViewTime),
  });
  // `status: "not_done"` explicite : le compteur porte sur ce qui reste a faire, pas sur
  // les urgences deja traitees. Le total vient de la pagination du backend, pas de la
  // taille de la page chargee.
  const urgentTasksFilters = { priority: "high", status: "not_done" } as const;
  const urgentTasksQuery = useQuery({
    queryKey: project ? buildTasksListQuery(api, project.id, urgentTasksFilters).queryKey : queryKeys.disabled(),
    queryFn: () => buildTasksListQuery(api, project!.id, urgentTasksFilters).queryFn(),
    enabled: Boolean(project && canViewTasks),
  });
  const urgentTasksCount = getApiCount(urgentTasksQuery.data);
  const createDayEntry = useCrudMutation({
    mutationFn: (payload: DayEntryPayload) => api.tasks.createDayEntry(project!.id, payload),
    invalidateKey: project ? [queryKeys.tasks.all(project.id), queryKeys.timeEntries.all(project.id)] : undefined,
    successMessage: "Entree de journee creee",
    onSuccess: () => setDayEntryDialogOpen(false),
  });
  const invitations = normalizeApiList(invitationsQuery.data);
  const financeChart = financeQuery.data;
  const financeTotals = financeChart?.totals ?? {
    count: 0,
    expenses: "0",
    refunds: "0",
    balance: "0",
  };
  const financePoints = financeChart?.series ?? [];
  const unpaidMinutes = timeStatsQuery.data?.duration_minutes ?? 0;
  const unpaidAmount = Number(timeStatsQuery.data?.remaining_amount ?? 0);
  const isFinanceLoading = financeQuery.isLoading;
  const financeError = getErrorMessage(financeQuery.error);

  if (isLoading) {
    return <ProjectDashboardSkeleton />;
  }

  if (!project) {
    return (
      <NoProjectState
        icon={Plus}
        description="Cree un projet depuis la barre laterale ou utilise le bouton ci-dessous pour commencer."
        onCreateProject={onCreateProject}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge variant="secondary">Projet actif</Badge>
            <h2 className="mt-3 truncate text-2xl font-semibold">{project.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {project.description || "Aucune description pour ce projet."}
            </p>
          </div>
        </div>
      </section>

      {canEditTasks && canRecordTime ? (
        <Card className="rounded-lg border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CalendarCheck className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Fin de journee de travail ?</p>
                <p className="text-sm text-muted-foreground">Enregistre la tache et le temps de chaque personne en une fois.</p>
              </div>
            </div>
            <Button type="button" className="gap-2" onClick={() => setDayEntryDialogOpen(true)}>
              Nouvelle entree de journee
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canViewTasks || canViewTime ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {canViewTasks ? (
            <SummaryTile
              icon={CheckCircle2}
              label="Taches urgentes"
              value={urgentTasksQuery.isLoading ? "..." : String(urgentTasksCount)}
              detail={urgentTasksCount === 0 ? "Aucune urgence pour le moment." : `${urgentTasksCount} tache${urgentTasksCount > 1 ? "s" : ""} haute priorite.`}
              href={`/tasks?project=${project.id}&priority=high`}
            />
          ) : null}
          {canViewTime ? (
            <SummaryTile
              icon={Clock3}
              label="Heures impayees"
              value={timeStatsQuery.isLoading ? "..." : formatDuration(unpaidMinutes)}
              detail={`${formatMoney(unpaidAmount)} restant a payer.`}
              href={buildUnpaidTimeHref(project.id, defaultTimeUserFilter)}
            />
          ) : null}
        </div>
      ) : null}

      {canViewMembers || canViewFinance ? (
      <div className={canViewMembers && canViewFinance ? "grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]" : "grid gap-4"}>
        {canViewMembers ? (
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <p className="font-medium">Membres du projet</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/settings?project=${project.id}&tab=members`}>Gerer</Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {members.length} membre(s), {invitations.length} invitation(s).
            </p>
            <div className="mt-4 grid gap-2">
              {members.map((member) => {
                const isOwner = member.user === project.owner;
                return (
                  <MutedInfoCard key={member.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <MemberAvatar
                          name={member.user_display_name}
                          pictureUrl={member.user_picture_url}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{member.user_display_name}</p>
                          {!isOwner ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {member.role_deleted ? "Aucun role actif" : member.role_name}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <MemberTypeBadge isOwner={isOwner} roleDeleted={member.role_deleted} />
                    </div>
                  </MutedInfoCard>
                );
              })}
              {invitations.map((invitation) => (
                <MutedInfoCard key={`invitation-${invitation.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{invitation.role_name}</p>
                    </div>
                    <InvitationStatusBadge status="pending" />
                  </div>
                </MutedInfoCard>
              ))}
              {members.length === 0 && invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun membre ou invitation pour le moment.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        ) : null}

        {canViewFinance ? (
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <WalletCards className="size-4 text-primary" />
              <p className="font-medium">Finance</p>
            </div>
            <div className="mt-4 grid gap-2">
              {isFinanceLoading ? (
                <FinanceLoadingState />
              ) : financeError ? (
                <FormErrorAlert error={financeError} />
              ) : (
                <>
                  <FinanceTimelineChart points={financePoints} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FinanceLine label="Depenses" value={formatMoney(financeTotals.expenses)} />
                    <FinanceLine label="Remboursements" value={formatMoney(financeTotals.refunds)} />
                    <FinanceLine label="Net" value={formatMoney(financeTotals.balance)} />
                    <FinanceLine label="Operations" value={String(financeTotals.count)} />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}

      <DayEntryFormDialog
        open={dayEntryDialogOpen}
        projectId={project.id}
        members={members}
        folders={folders}
        canViewFiles={canViewFiles}
        isPending={createDayEntry.isPending}
        error={createDayEntry.error}
        onOpenChange={setDayEntryDialogOpen}
        onCreateFolderAction={canEditTasks ? handleCreateFolder : undefined}
        onSubmit={(payload) => { if (canEditTasks && canRecordTime) createDayEntry.mutate(payload); }}
      />
    </div>
  );
}

function FinanceLoadingState() {
  return (
    <>
      <Skeleton className="h-40 rounded-md" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
    </>
  );
}

function FinanceTimelineChart({
  points,
}: {
  points: Array<{ period: string; expenses: string; refunds: string; balance: string }>;
}) {
  const data = points.map((p) => ({
    period: p.period,
    expenses: Number(p.expenses),
    refunds: Number(p.refunds),
  }));

  if (data.length === 0) {
    return (
      <Empty className="h-44 rounded-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WalletCards className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Aucune donnee finance</EmptyTitle>
          <EmptyDescription>Aucune operation finance pour le moment.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <ChartContainer config={financeChartConfig} className="h-44 w-full">
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatFinancePeriod}
          />
          <ChartTooltip content={<DashboardFinanceTooltip />} />
          <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="refunds" fill="var(--color-refunds)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-destructive" />
          Depenses
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "oklch(0.6 0.15 150)" }} />
          Remboursements
        </span>
      </div>
    </div>
  );
}

function DashboardFinanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-border/50 bg-background grid min-w-[9rem] gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{formatFinancePeriod(label ?? "")}</p>
      <div className="grid gap-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <div className="flex flex-1 items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {item.name === "expenses" ? "Depenses" : "Remboursements"}
              </span>
              <span className="font-mono font-medium tabular-nums">{formatMoney(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SummaryTile({
  href,
  icon: Icon,
  label,
  value,
  detail,
}: {
  href?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  const content = (
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-primary" />
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </CardContent>
  );

  if (href) {
    return (
      <Card className="rounded-lg transition-colors hover:bg-muted/35">
        <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {content}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg">
      {content}
    </Card>
  );
}

function buildUnpaidTimeHref(projectId: number, userFilter: "mine" | "all") {
  const params = new URLSearchParams({
    project: String(projectId),
    user: userFilter,
  });
  return `/time?${params.toString()}`;
}

function ProjectDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-4 h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}
