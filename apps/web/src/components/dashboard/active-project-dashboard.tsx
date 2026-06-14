import type { Project } from "@project-gestion/types";
import type { ComponentType } from "react";
import { CheckCircle2, Clock3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ActiveProjectDashboardProps = {
  project: Project | null;
  isLoading: boolean;
  onCreateProject: () => void;
};

export function ActiveProjectDashboard({
  project,
  isLoading,
  onCreateProject,
}: ActiveProjectDashboardProps) {
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

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryTile
          icon={CheckCircle2}
          label="Taches urgentes"
          value="0"
          detail="Aucune urgence pour le moment."
        />
        <SummaryTile
          icon={Clock3}
          label="Heures impayees"
          value="0h"
          detail="A valider quand le suivi temps sera connecte."
        />
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</p>
          <Icon className="size-4 shrink-0 text-primary" />
        </div>
        <p className="mt-3 text-xl font-semibold">{value}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyProjectState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-8 text-center">
      <h2 className="text-xl font-semibold">Aucun projet actif</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Cree un projet depuis la barre laterale ou utilise le bouton ci-dessous pour commencer.
      </p>
      <Button className="mt-5" onClick={onCreateProject}>
        <Plus className="size-4" />
        Creer un projet
      </Button>
    </section>
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
