import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { SettingsPageContent } from "@/app/settings/settings-page-content";

export default function SettingsPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
