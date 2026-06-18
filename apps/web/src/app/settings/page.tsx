import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { ProjectSettingsPage } from "@/components/dashboard/project-settings-page";

export default function SettingsPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <ProjectSettingsPage />
    </Suspense>
  );
}
