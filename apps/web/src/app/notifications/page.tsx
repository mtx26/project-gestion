import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { NotificationsPageContent } from "./notifications-page-content";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <NotificationsPageContent />
    </Suspense>
  );
}
