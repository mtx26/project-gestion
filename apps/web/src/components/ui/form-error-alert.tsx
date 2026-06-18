import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormErrorAlert({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
