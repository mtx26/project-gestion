import { useAuthStore } from "../../../stores/auth-store";
import { useProjectStore } from "../../../stores/project-store";
import { useProjects } from "./use-projects";

export function useSelectedProject() {
  const { projects, ...projectsQuery } = useProjects();
  const user = useAuthStore((state) => state.user);
  const manualSelectedProjectId = useProjectStore((state) => state.manualSelectedProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);

  const backendDefaultProjectId = user?.profile?.default_project
    ? String(user.profile.default_project)
    : "";
  const preferredProjectId = manualSelectedProjectId || backendDefaultProjectId;
  const selectedProjectId = projects.some((project) => String(project.id) === preferredProjectId)
    ? preferredProjectId
    : (projects[0] ? String(projects[0].id) : "");
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId) ?? null;

  return {
    ...projectsQuery,
    projects,
    selectedProjectId,
    selectedProject,
    selectProject,
  };
}
