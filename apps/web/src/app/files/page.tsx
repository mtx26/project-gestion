import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { ProjectFilesPageContent } from "./project-files-page-content";

export default function FilesPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <ProjectFilesPageContent />
    </Suspense>
  );
}
