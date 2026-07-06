import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { RequestsPageContent } from "./requests-page-content";

export default function RequestsPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <RequestsPageContent />
    </Suspense>
  );
}
