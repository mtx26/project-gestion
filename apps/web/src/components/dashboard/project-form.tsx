import type { ProjectFormValues } from "@project-gestion/validation";
import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="space-y-2">
        <Label htmlFor="project-name">Nom</Label>
        <Input id="project-name" placeholder="Ex. Renovation maison" {...form.register("name")} />
        <FormError message={form.formState.errors.name?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          rows={5}
          placeholder="Objectif, contexte ou perimetre du projet"
          {...form.register("description")}
        />
      </div>

      <FormError message={error} />

      <Button className="w-full" type="submit" disabled={isPending}>
        <Plus className="size-4" />
        {isPending ? "Creation..." : submitLabel}
      </Button>
    </form>
  );
}
