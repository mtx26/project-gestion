"use client";

import type { Project } from "@project-gestion/types";
import { queryKeys } from "@project-gestion/query-keys";
import { normalizeApiList } from "@project-gestion/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildProjectHref } from "@/lib/url-params";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useAuthStore } from "@/stores/auth-store";

type ActiveItem = "dashboard" | "settings" | "files" | "tasks" | "calendar" | "time" | "finance" | "requests" | "trash" | "account" | "notifications";

const ACTIVE_ITEMS: readonly ActiveItem[] = [
  "dashboard", "settings", "files", "tasks", "calendar", "time", "finance", "requests", "trash", "account", "notifications",
];

/** Derives the sidebar's highlighted item from the route, so pages no longer pass
 * `activeItem` by hand (and risk drifting out of sync with their own path). */
function getActiveItemFromPathname(pathname: string): ActiveItem {
  const segment = pathname.split("/")[1] ?? "";
  if (segment === "invitations") return "notifications";
  return (ACTIVE_ITEMS as readonly string[]).includes(segment) ? (segment as ActiveItem) : "dashboard";
}

interface ProjectWorkspaceShellProps {
  maxWidthClassName?: string;
  children: (state: ProjectWorkspaceState) => React.ReactNode;
}

export interface ProjectWorkspaceState {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  projects: Project[];
  projectsQuery: ReturnType<typeof useQuery<Project[] | { results: Project[] }>>;
  selectedProjectId: string;
  selectedProject: Project | null;
  openCreateProject: () => void;
}

export function ProjectWorkspaceShell({
  maxWidthClassName = "max-w-6xl",
  children,
}: ProjectWorkspaceShellProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeItem = getActiveItemFromPathname(pathname);
  const selectedProjectIdFromUrl = searchParams.get("project") ?? "";
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [manualSelectedProjectId, setManualSelectedProjectId] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: api.projects.list,
  });

  const projects = normalizeApiList(projectsQuery.data);
  const backendDefaultProjectId = user?.profile?.default_project ? String(user.profile.default_project) : "";
  const preferredProjectId = manualSelectedProjectId || selectedProjectIdFromUrl || backendDefaultProjectId;
  const selectedProjectId = projects.some((project) => String(project.id) === preferredProjectId)
    ? preferredProjectId
    : projects[0]
      ? String(projects[0].id)
      : "";
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId) ?? null;

  const createProject = useCrudMutation({
    mutationFn: api.projects.create,
    invalidateKey: queryKeys.projects.all,
    successMessage: "Projet cree",
    onSuccess: (project) => {
      setManualSelectedProjectId(String(project.id));
      setCreateDialogOpen(false);
      router.push(buildProjectHref(pathname, project.id, searchParams));
    },
  });

  const setDefaultProject = useCrudMutation({
    mutationFn: (projectId: number | null) =>
      api.auth.updateMe({ profile: { default_project: projectId } }),
    successMessage: "Projet par defaut mis a jour",
    onSuccess: (updatedUser) => setUser(updatedUser),
  });

  async function onLogout() {
    await logout();
    queryClient.clear();
    window.location.assign("/auth/login");
  }

  function onSelectProject(id: number) {
    setManualSelectedProjectId(String(id));
    router.push(buildProjectHref(pathname, id, searchParams));
  }

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <DashboardSidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          defaultProjectId={backendDefaultProjectId}
          userId={user?.id ?? null}
          user={user}
          activeItem={activeItem}
          isLoading={projectsQuery.isLoading}
          onSelectProject={onSelectProject}
          onSetDefaultProject={(id) => setDefaultProject.mutate(id)}
          onCreateProject={() => setCreateDialogOpen(true)}
          onLogout={onLogout}
        />

        <SidebarInset>
          <div className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 ${maxWidthClassName}`}>
            <div className="mb-4">
              <SidebarTrigger />
            </div>

            <FormErrorAlert error={getErrorMessage(projectsQuery.error)} className="mb-6" />

            {children({
              user,
              projects,
              projectsQuery,
              selectedProjectId,
              selectedProject,
              openCreateProject: () => setCreateDialogOpen(true),
            })}
          </div>
        </SidebarInset>

        <CreateProjectDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={(values) => createProject.mutate(values)}
          error={createProject.error}
          isPending={createProject.isPending}
        />
      </SidebarProvider>
    </ProtectedRoute>
  );
}
