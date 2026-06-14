import type { Project } from "@project-gestion/types";
import { FolderKanban, LayoutDashboard, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type DashboardSidebarProps = {
  projects: Project[];
  selectedProjectId: string;
  userId: number | null;
  activeItem: "dashboard" | "settings";
  isLoading: boolean;
  onSelectProject: (id: number) => void;
  onCreateProject: () => void;
};

export function DashboardSidebar({
  projects,
  selectedProjectId,
  userId,
  activeItem,
  isLoading,
  onSelectProject,
  onCreateProject,
}: DashboardSidebarProps) {
  const settingsHref = selectedProjectId ? `/settings?project=${selectedProjectId}` : "/settings";
  const navigation = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "settings", href: settingsHref, label: "Parametres projet", icon: Settings },
  ] as const;

  return (
    <aside className="border-b bg-card px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 text-base font-semibold">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FolderKanban className="size-5" />
        </span>
        Project Gestion
      </Link>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Projet</p>
            <p className="text-xs text-muted-foreground">Contexte actif</p>
          </div>
          <Button size="icon-sm" onClick={onCreateProject} aria-label="Ajouter un projet">
            <Plus className="size-4" />
          </Button>
        </div>

        <Select
          value={selectedProjectId}
          onValueChange={(value) => onSelectProject(Number(value))}
          disabled={isLoading || projects.length === 0}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder={isLoading ? "Chargement..." : "Choisir un projet"} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => {
              const isShared = userId !== null && project.owner !== userId;

              return (
                <SelectItem key={project.id} value={String(project.id)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{project.name}</span>
                    {isShared ? (
                      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                        Partage par {project.owner_display_name}
                      </Badge>
                    ) : null}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </section>

      <Separator className="my-6" />

      <nav className="space-y-1 text-sm">
        {navigation.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 font-medium ${
              item.key === activeItem
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
