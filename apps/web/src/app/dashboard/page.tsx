"use client";

import { ActiveProjectDashboard } from "@/components/dashboard/active-project-dashboard";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";

export default function DashboardPage() {
  return (
    <ProjectWorkspaceShell activeItem="dashboard">
      {({ selectedProject, projectsQuery, openCreateProject }) => (
        <ActiveProjectDashboard
          project={selectedProject}
          isLoading={projectsQuery.isLoading}
          onCreateProject={openCreateProject}
        />
      )}
    </ProjectWorkspaceShell>
  );
}
