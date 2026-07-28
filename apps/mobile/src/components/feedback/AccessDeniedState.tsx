import { Lock } from "lucide-react-native";
import { Text, View } from "react-native";
import { theme } from "../../theme";

interface AccessDeniedStateProps {
  label: string;
}

export function AccessDeniedState({ label }: AccessDeniedStateProps) {
  return (
    <View className="items-center gap-3 rounded-md border border-border bg-surface p-6">
      <Lock size={theme.iconSize.lg} color={theme.colors.muted} />
      <Text className="text-center text-sm text-muted">
        Tu n&apos;as pas la permission de voir « {label} » sur ce projet.
      </Text>
    </View>
  );
}
