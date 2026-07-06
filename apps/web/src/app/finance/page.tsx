import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { FinancePageContent } from "./finance-page-content";

export default function FinancePage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <FinancePageContent />
    </Suspense>
  );
}
