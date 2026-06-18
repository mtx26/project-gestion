import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormErrorAlert({ error, className }: { error: string | null | undefined; className?: string }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
