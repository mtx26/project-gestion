import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { TasksPageContent } from "./tasks-page-content";

export default function TasksPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <TasksPageContent />
    </Suspense>
  );
}
