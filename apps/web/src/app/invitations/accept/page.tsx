import { Suspense } from "react";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { InvitationsAcceptPageContent } from "./invitations-accept-page-content";

export default function InvitationAcceptPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <InvitationsAcceptPageContent />
    </Suspense>
  );
}
