import { Text, View } from "react-native";
import { Button } from "../ui/Button";

interface ErrorStateProps {
  message?: string | null;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center gap-3 rounded-md border border-danger/30 bg-danger/10 p-4">
      <Text className="text-center text-sm text-danger" accessibilityRole="alert">
        {message ?? "Une erreur est survenue."}
      </Text>
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry}>
          Reessayer
        </Button>
      ) : null}
    </View>
  );
}
