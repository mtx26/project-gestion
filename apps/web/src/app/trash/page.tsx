import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { TrashPageContent } from "./trash-page-content";

export default function TrashPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <TrashPageContent />
    </Suspense>
  );
}
