import type { Project } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { CheckCircle2, Clock3, Plus, Users, WalletCards } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Badge } from "@/components/ui/badge";
import { InvitationStatusBadge } from "@/components/badges/invitation-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type ActiveProjectDashboardProps = {
  project: Project | null;
  userId: number | null;
  isLoading: boolean;
  onCreateProject: () => void;
};


export function ActiveProjectDashboard({
  project,
  userId,
  isLoading,
  onCreateProject,
}: ActiveProjectDashboardProps) {
  const canViewMembers = hasProjectPermission(project, userId, permissionCodes.memberView);
  const canViewFinance = hasProjectPermission(project, userId, permissionCodes.financeView);
  const canViewTasks = hasProjectPermission(project, userId, permissionCodes.taskView);
  const canViewTime = hasProjectPermission(project, userId, permissionCodes.timeEntryView);
  const canViewAllTime = hasProjectPermission(project, userId, permissionCodes.timeEntryViewAll);
  const canPayTime = hasProjectPermission(project, userId, permissionCodes.timeEntryPay);
  const defaultTimeUserFilter = canViewAllTime && canPayTime ? "all" : "mine";
  const membersQuery = useQuery({
    queryKey: project ? queryKeys.members.list(project.id) : ["members", "disabled"],
    queryFn: () => api.members.list(project!.id),
    enabled: Boolean(project && canViewMembers),
  });
  const invitationsQuery = useQuery({
    queryKey: project ? queryKeys.invitations.all(project.id) : ["invitations", "disabled"],
    queryFn: () => api.invitations.list(project!.id),
    enabled: Boolean(project && canViewMembers),
  });
  const financeQuery = useQuery({
    queryKey: project ? queryKeys.financialEntries.chart(project.id, "month") : ["finance", "chart", "disabled"],
    queryFn: () => api.financialEntries.chart(project!.id, { group_by: "month" }),
    enabled: Boolean(project && canViewFinance),
  });
  const timeStatsQuery = useQuery({
    queryKey: project
      ? queryKeys.timeEntries.stats(project.id, {
          userId: defaultTimeUserFilter === "all" ? "all" : userId ?? undefined,
          paymentStatus: "not_paid",
        })
      : ["time-entries", "stats", "disabled"],
    queryFn: () => api.timeEntries.stats(project!.id, {
      ...(defaultTimeUserFilter === "all" || userId == null ? {} : { user: userId }),
      payment_status: "not_paid",
    }),
    enabled: Boolean(project && canViewTime),
  });
  const urgentTasksQuery = useQuery({
    queryKey: project ? queryKeys.tasks.list(project.id, { priority: "high" }) : ["tasks", "urgent", "disabled"],
    queryFn: () => api.tasks.list(project!.id, { priority: "high" }),
    enabled: Boolean(project && canViewTasks),
  });
  const urgentTasks = normalizeApiList(urgentTasksQuery.data).filter((t) => t.status !== "done");
  const members = normalizeApiList(membersQuery.data);
  const invitations = normalizeApiList(invitationsQuery.data);
  const visibleMembers = members;
  const visibleInvitations = invitations;
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
    return <EmptyProjectState onCreateProject={onCreateProject} />;
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

      {canViewTasks || canViewTime ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {canViewTasks ? (
            <SummaryTile
              icon={CheckCircle2}
              label="Taches urgentes"
              value={urgentTasksQuery.isLoading ? "..." : String(urgentTasks.length)}
              detail={urgentTasks.length === 0 ? "Aucune urgence pour le moment." : `${urgentTasks.length} tache${urgentTasks.length > 1 ? "s" : ""} haute priorite.`}
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
              {visibleMembers.map((member) => {
                const isOwner = member.user === project.owner;
                return (
                  <div key={member.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <DashboardMemberAvatar
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
                      <Badge variant={isOwner ? "default" : member.role_deleted ? "destructive" : "secondary"}>
                        {isOwner ? "Proprietaire" : member.role_deleted ? "Sans role" : "Membre"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {visibleInvitations.map((invitation) => (
                <div key={`invitation-${invitation.id}`} className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{invitation.role_name}</p>
                    </div>
                    <InvitationStatusBadge status="pending" />
                  </div>
                </div>
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

const dashboardChartConfig = {
  expenses: { label: "Depenses", color: "var(--destructive)" },
  refunds: { label: "Remboursements", color: "oklch(0.6 0.15 150)" },
};

function FinanceTimelineChart({
  points,
}: {
  points: Array<{ period: string; expenses: string; refunds: string; balance: string }>;
}) {
  const data = points.slice(-8).map((p) => ({
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
      <ChartContainer config={dashboardChartConfig} className="h-44 w-full">
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

function formatMoney(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);

  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDuration(totalMinutes: number) {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatFinancePeriod(period: string) {
  const [year, month, day] = period.split("-");

  if (year && month && day) {
    return `${day}/${month}`;
  }

  if (year && month) {
    return `${month}/${year.slice(2)}`;
  }

  return period;
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
    payment: "unpaid",
    user: userFilter,
  });
  return `/time?${params.toString()}`;
}

function EmptyProjectState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <Empty className="border bg-card p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Plus className="size-4" />
        </EmptyMedia>
        <EmptyTitle>Aucun projet actif</EmptyTitle>
        <EmptyDescription>
          Cree un projet depuis la barre laterale ou utilise le bouton ci-dessous pour commencer.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreateProject}>
          <Plus className="size-4" />
          Creer un projet
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function DashboardMemberAvatar({ name, pictureUrl }: { name: string; pictureUrl: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pictureUrl} alt={name} className="size-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
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
