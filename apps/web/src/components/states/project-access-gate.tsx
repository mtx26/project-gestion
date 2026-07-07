import type { ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { NoProjectState } from "@/components/states/no-project-state";

interface ProjectAccessGateProps {
  isLoadingProjects: boolean;
  hasProject: boolean;
  hasAccess: boolean;
  icon: ComponentType<{ className?: string }>;
  noProjectDescription: string;
  accessDeniedDescription: string;
  onCreateProject: () => void;
}

/** Guards a project-scoped page while the project list is loading, no project
 * is selected yet, or the current role lacks access — the three states every
 * `<Feature>PageContent` must resolve before rendering its own view. */
export function ProjectAccessGate({
  isLoadingProjects,
  hasProject,
  hasAccess,
  icon,
  noProjectDescription,
  accessDeniedDescription,
  onCreateProject,
}: ProjectAccessGateProps) {
  if (isLoadingProjects) return <Skeleton className="h-72 rounded-lg" />;
  if (!hasProject) {
    return <NoProjectState icon={icon} description={noProjectDescription} onCreateProject={onCreateProject} />;
  }
  if (!hasAccess) return <AccessDeniedState description={accessDeniedDescription} />;
  return null;
}
