"use client";

import type { Project } from "@project-gestion/types";
import { projectSchema, type ProjectFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryKeys } from "@project-gestion/query-keys";
import { normalizeApiList } from "@project-gestion/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth-store";

type ProjectWorkspaceShellProps = {
  activeItem: "dashboard" | "settings" | "files" | "tasks" | "calendar" | "time" | "finance" | "requests" | "trash" | "account" | "notifications";
  selectedProjectIdFromUrl?: string;
  maxWidthClassName?: string;
  onProjectSelected?: (id: number) => void;
  onProjectCreated?: (project: Project) => void;
  children: (state: ProjectWorkspaceState) => React.ReactNode;
};

export type ProjectWorkspaceState = {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  projects: Project[];
  projectsQuery: ReturnType<typeof useQuery<Project[] | { results: Project[] }>>;
  selectedProjectId: string;
  selectedProject: Project | null;
  openCreateProject: () => void;
};

export function ProjectWorkspaceShell({
  activeItem,
  selectedProjectIdFromUrl = "",
  maxWidthClassName = "max-w-6xl",
  onProjectSelected,
  onProjectCreated,
  children,
}: ProjectWorkspaceShellProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [manualSelectedProjectId, setManualSelectedProjectId] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: api.projects.list,
  });

  const projects = normalizeApiList(projectsQuery.data);
  const preferredProjectId = manualSelectedProjectId || selectedProjectIdFromUrl;
  const selectedProjectId = projects.some((project) => String(project.id) === preferredProjectId)
    ? preferredProjectId
    : projects[0]
      ? String(projects[0].id)
      : "";
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId) ?? null;

  const createProject = useMutation({
    mutationFn: api.projects.create,
    onSuccess: async (project) => {
      toast.success("Projet cree");
      form.reset();
      setManualSelectedProjectId(String(project.id));
      setCreateDialogOpen(false);
      onProjectCreated?.(project);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  async function onLogout() {
    await logout();
    queryClient.clear();
    window.location.assign("/auth/login");
  }

  function onSelectProject(id: number) {
    setManualSelectedProjectId(String(id));
    onProjectSelected?.(id);
  }

  function onCreateProject(values: ProjectFormValues) {
    createProject.mutate({
      name: values.name,
      description: values.description?.trim() || null,
    });
  }

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <DashboardSidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          userId={user?.id ?? null}
          user={user}
          activeItem={activeItem}
          isLoading={projectsQuery.isLoading}
          onSelectProject={onSelectProject}
          onCreateProject={() => setCreateDialogOpen(true)}
          onLogout={onLogout}
        />

        <SidebarInset>
          <div className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 ${maxWidthClassName}`}>
            <div className="mb-4">
              <SidebarTrigger />
            </div>

            <FormErrorAlert error={projectsQuery.error ? getErrorMessage(projectsQuery.error) : null} className="mb-6" />

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
          form={form}
          onSubmit={onCreateProject}
          error={createProject.error ? getErrorMessage(createProject.error) : null}
          isPending={createProject.isPending}
        />
      </SidebarProvider>
    </ProtectedRoute>
  );
}
