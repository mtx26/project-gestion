import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { FilesPageContent } from "./files-page-content";

export default function FilesPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <FilesPageContent />
    </Suspense>
  );
}
