import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 rounded-md border border-border bg-surface p-6">
      <Text className="text-base font-semibold text-foreground">{title}</Text>
      {description ? (
        <Text className="text-center text-sm text-muted">{description}</Text>
      ) : null}
      {action}
    </View>
  );
}
