import type { ProjectFormValues } from "@project-gestion/validation";
import type { UseFormReturn } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectForm } from "@/components/dashboard/project-form";

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void;
  error: string | null;
  isPending: boolean;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  error,
  isPending,
}: CreateProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
          <DialogDescription>
            Ajoute un projet; il devient automatiquement le projet actif.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm form={form} onSubmit={onSubmit} error={error} isPending={isPending} />
      </DialogContent>
    </Dialog>
  );
}
