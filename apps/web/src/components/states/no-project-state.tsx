import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface NoProjectStateProps {
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  description: string;
  onCreateProject: () => void;
}

export function NoProjectState({ icon: Icon, title = "Aucun projet actif", description, onCreateProject }: NoProjectStateProps) {
  return (
    <Empty className="border bg-card p-8">
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia variant="icon">
            <Icon className="size-4" />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreateProject}>Creer un projet</Button>
      </EmptyContent>
    </Empty>
  );
}
