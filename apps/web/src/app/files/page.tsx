import { Suspense } from "react";
import { ProjectFilesPageContent } from "./project-files-page-content";

export default function FilesPage() {
  return (
    <Suspense fallback={null}>
      <ProjectFilesPageContent />
    </Suspense>
  );
}
