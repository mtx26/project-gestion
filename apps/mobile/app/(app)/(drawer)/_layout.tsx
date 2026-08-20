import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { Bell } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { ProjectDrawerContent } from "../../../src/components/navigation/ProjectDrawerContent";
import { useUnreadNotificationsCount } from "../../../src/features/notifications/hooks/use-notifications";
import { theme } from "../../../src/theme";

function NotificationsHeaderButton() {
  const router = useRouter();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"
      }
      hitSlop={8}
      className="mr-1 h-11 w-11 items-center justify-center"
    >
      <Bell size={theme.iconSize.md} color={theme.colors.foreground} />
      {unreadCount > 0 ? (
        <View className="absolute right-1.5 top-1.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1">
          <Text className="text-[10px] font-semibold text-primaryForeground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <ProjectDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: theme.colors.foreground,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerRight: () => <NotificationsHeaderButton />,
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Dashboard" }} />
      <Drawer.Screen name="files" options={{ title: "Projet" }} />
      <Drawer.Screen name="calendar" options={{ title: "Calendrier" }} />
      <Drawer.Screen name="tasks" options={{ title: "Taches" }} />
      <Drawer.Screen name="time" options={{ title: "Temps" }} />
      <Drawer.Screen name="finance" options={{ title: "Finances" }} />
      <Drawer.Screen name="requests" options={{ title: "Remboursements" }} />
      <Drawer.Screen name="trash" options={{ title: "Corbeille" }} />
      <Drawer.Screen name="settings" options={{ title: "Parametres projet" }} />
    </Drawer>
  );
}
