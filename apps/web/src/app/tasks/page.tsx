import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { ProjectTasksPageContent } from "./project-tasks-page-content";

export default function TasksPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <ProjectTasksPageContent />
    </Suspense>
  );
}
