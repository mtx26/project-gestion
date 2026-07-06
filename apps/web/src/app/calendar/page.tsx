import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { CalendarPageContent } from "./calendar-page-content";

export default function CalendarPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <CalendarPageContent />
    </Suspense>
  );
}
