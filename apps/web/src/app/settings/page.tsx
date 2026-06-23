import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { ProjectSettingsPage } from "@/app/settings/components/project-settings-page";

export default function SettingsPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <ProjectSettingsPage />
    </Suspense>
  );
}
