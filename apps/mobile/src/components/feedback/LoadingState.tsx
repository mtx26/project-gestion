import { ActivityIndicator, View } from "react-native";
import { theme } from "../../theme";

export function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}
