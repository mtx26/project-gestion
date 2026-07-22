"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  maxWidth?: "md" | "lg";
  error?: string | null;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** Coquille commune aux modals de creation/edition : Dialog + header + footer + erreur. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  maxWidth = "lg",
  error,
  footer,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          maxWidth === "md" ? "sm:max-w-md" : "sm:max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle className="pr-6">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4">
          {children}
          <FormErrorAlert error={error} />
        </div>
        <DialogFooter className="flex-row flex-wrap items-center justify-end">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
