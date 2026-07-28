import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../../components/ui/Button";
import { useAuthStore } from "../../../stores/auth-store";

export function AccountScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 gap-4 px-5 py-6">
        <Text className="text-2xl font-semibold text-foreground">Mon compte</Text>
        <View className="gap-1 rounded-md border border-border bg-surface p-4">
          <Text className="text-base font-medium text-foreground">
            {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username}
          </Text>
          <Text className="text-sm text-muted">{user?.email}</Text>
        </View>
        <Text className="text-sm text-muted">
          Modification du profil et de la photo — a venir.
        </Text>
        <Button variant="ghost" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    </SafeAreaView>
  );
}
