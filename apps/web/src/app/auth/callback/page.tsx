import { Suspense } from "react";
import { AuthCallbackContent } from "@/app/auth/callback/components/auth-callback-content";

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackContent />
    </Suspense>
  );
}
