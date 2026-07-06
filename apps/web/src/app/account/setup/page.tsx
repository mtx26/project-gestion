import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { AccountSetupPageContent } from "./account-setup-page-content";

export default function AccountSetupPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <AccountSetupPageContent />
    </Suspense>
  );
}
