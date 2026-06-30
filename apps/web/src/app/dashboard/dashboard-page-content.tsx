"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ActiveProjectDashboard } from "@/app/dashboard/components/active-project-dashboard";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { buildProjectHref } from "@/lib/url-params";

export function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="dashboard"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildProjectHref("/dashboard", id, searchParams))}
      onProjectCreated={(project) => router.push(buildProjectHref("/dashboard", project.id, searchParams))}
    >
      {({ user, selectedProject, projectsQuery, openCreateProject }) => (
        <ActiveProjectDashboard
          project={selectedProject}
          userId={user?.id ?? null}
          isLoading={projectsQuery.isLoading}
          onCreateProject={openCreateProject}
        />
      )}
    </ProjectWorkspaceShell>
  );
}
