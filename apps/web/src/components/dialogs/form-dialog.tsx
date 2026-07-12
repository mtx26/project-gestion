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
      <DialogContent className={maxWidth === "md" ? "sm:max-w-md" : "sm:max-w-lg"}>
        <DialogHeader className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-xl bg-popover px-4 pt-4 pb-2">
          <DialogTitle className="pr-6">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        <FormErrorAlert error={error} />
        <DialogFooter className="flex-row flex-wrap items-center justify-end">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
