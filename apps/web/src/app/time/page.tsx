import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { TimePageContent } from "./time-page-content";

export default function TimePage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <TimePageContent />
    </Suspense>
  );
}
