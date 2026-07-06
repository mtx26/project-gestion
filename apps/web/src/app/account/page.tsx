import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { AccountPageContent } from "./account-page-content";

export default function AccountPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <AccountPageContent />
    </Suspense>
  );
}
