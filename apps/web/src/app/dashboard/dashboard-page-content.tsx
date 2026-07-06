"use client";

import { DashboardView } from "@/app/dashboard/components/dashboard-view";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";

export function DashboardPageContent() {
  return (
    <ProjectWorkspaceShell>
      {({ user, selectedProject, projectsQuery, openCreateProject }) => (
        <DashboardView
          project={selectedProject}
          userId={user?.id ?? null}
          isLoading={projectsQuery.isLoading}
          onCreateProject={openCreateProject}
        />
      )}
    </ProjectWorkspaceShell>
  );
}
