import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type NoProjectStateProps = {
  icon: ComponentType<{ className?: string }>;
  description: string;
  onCreateProject: () => void;
};

export function NoProjectState({ icon: Icon, description, onCreateProject }: NoProjectStateProps) {
  return (
    <Empty className="border bg-card p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>Aucun projet actif</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreateProject}>Creer un projet</Button>
      </EmptyContent>
    </Empty>
  );
}
