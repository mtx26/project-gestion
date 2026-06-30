import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { DashboardPageContent } from "./dashboard-page-content";

export default function DashboardPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <DashboardPageContent />
    </Suspense>
  );
}
