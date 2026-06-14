import { Suspense } from "react";
import { ProjectSettingsPage } from "@/components/dashboard/project-settings-page";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectSettingsPage />
    </Suspense>
  );
}
