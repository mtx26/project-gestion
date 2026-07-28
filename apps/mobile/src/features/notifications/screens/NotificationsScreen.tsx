import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/feedback/EmptyState";

export function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 gap-4 px-5 py-6">
        <Text className="text-2xl font-semibold text-foreground">Notifications</Text>
        <EmptyState
          title="Aucune notification"
          description="Cette section affichera tes notifications a venir."
        />
        <Button variant="ghost" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    </SafeAreaView>
  );
}
