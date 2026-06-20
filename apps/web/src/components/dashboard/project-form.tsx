import type { ProjectFormValues } from "@project-gestion/validation";
import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectFormProps = {
  form: UseFormReturn<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void;
  error: string | null;
  isPending: boolean;
  submitLabel?: string;
};

export function ProjectForm({
  form,
  onSubmit,
  error,
  isPending,
  submitLabel = "Creer le projet",
}: ProjectFormProps) {
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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

      <FormError message={error} />

      <Button className="w-full" type="submit" disabled={isPending}>
        <Plus className="size-4" />
        {isPending ? "Creation..." : submitLabel}
      </Button>
    </form>
  );
}
