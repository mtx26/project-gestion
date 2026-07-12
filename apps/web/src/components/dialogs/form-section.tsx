"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Groupe visuellement, dans un `FormDialog`, un ensemble de champs qui forme
 * sa propre sous-logique (une liste dynamique, un bloc de pieces jointes...) —
 * separateur + titre, jamais pour un champ simple isole. */
export function FormSection({ title, description, action, children, className }: FormSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <Label>{title}</Label>
        {action}
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {children}
    </div>
  );
}
