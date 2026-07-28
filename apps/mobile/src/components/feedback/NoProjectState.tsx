import { Plus } from "lucide-react-native";
import { Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../ui/Button";

interface NoProjectStateProps {
  description: string;
  onCreateProject: () => void;
}

export function NoProjectState({ description, onCreateProject }: NoProjectStateProps) {
  return (
    <View className="items-center gap-3 rounded-md border border-border bg-surface p-6">
      <Plus size={theme.iconSize.lg} color={theme.colors.muted} />
      <Text className="text-base font-semibold text-foreground">Aucun projet</Text>
      <Text className="text-center text-sm text-muted">{description}</Text>
      <Button onPress={onCreateProject}>Creer un projet</Button>
    </View>
  );
}
