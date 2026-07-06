import type { ProjectFormValues } from "@project-gestion/validation";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void;
  error: string | null;
  isPending: boolean;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  error,
  isPending,
}: CreateProjectDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau projet"
      description="Ajoute un projet; il devient automatiquement le projet actif."
      maxWidth="md"
      error={error}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="create-project-form"
            pending={isPending}
            disabled={isPending}
            label="Creer le projet"
            pendingLabel="Creation..."
          />
        </>
      }
    >
      <form id="create-project-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Field>
          <FieldLabel htmlFor="project-name">Nom</FieldLabel>
          <Input id="project-name" placeholder="Ex. Renovation maison" {...form.register("name")} />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="project-description">Description</FieldLabel>
          <Textarea
            id="project-description"
            rows={5}
            placeholder="Objectif, contexte ou perimetre du projet"
            {...form.register("description")}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
