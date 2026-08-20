import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { Bell } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { ProjectDrawerContent } from "../../../src/components/navigation/ProjectDrawerContent";
import { GlassCapsule } from "../../../src/components/ui/GlassCapsule";
import { useGlassEnabled } from "../../../src/components/ui/GlassSurface";
import { useThemeColors } from "../../../src/theme";
import { useUnreadNotificationsCount } from "../../../src/features/notifications/hooks/use-notifications";
import { theme } from "../../../src/theme";

function NotificationsHeaderButton() {
  const router = useRouter();
  const colors = useThemeColors();
  const unreadCount = useUnreadNotificationsCount();

  const bell = (
    <Pressable
      onPress={() => router.push("/notifications")}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"
      }
      hitSlop={8}
      className="h-11 w-11 items-center justify-center"
    >
      <Bell
        size={theme.iconSize.md}
        color={unreadCount > 0 ? colors.primaryForeground : colors.foreground}
      />
      {unreadCount > 0 ? (
        <View className="absolute right-1 top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1">
          <Text className="text-[10px] font-semibold text-dangerForeground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );

  // Le bouton appartient a la couche de navigation : capsule de verre teintee du
  // vert des qu'il y a des non-lues. Hors iOS 26, `GlassCapsule` retombe sur la
  // surface pleine, donc l'en-tete reste correct partout.
  return (
    <View className="mr-1">
      <GlassCapsule active={unreadCount > 0} interactive>
        {bell}
      </GlassCapsule>
    </View>
  );
}

export default function DrawerLayout() {
  const glassEnabled = useGlassEnabled();

  return (
    <Drawer
      drawerContent={(props) => <ProjectDrawerContent {...props} />}
      screenOptions={{
        // Fond et teinte viennent du `ThemeProvider` de app/_layout.tsx. Seul le
        // cas du verre s'en ecarte : sous iOS 26 le header porte le materiau du
        // systeme, qu'un fond opaque ecraserait.
        headerStyle: glassEnabled ? { backgroundColor: "transparent" } : undefined,
        headerRight: () => <NotificationsHeaderButton />,
        // Le panneau porte son propre verre (voir ProjectDrawerContent) : le fond
        // du navigateur doit s'effacer pour le laisser voir.
        // Idem : le panneau prend la couleur du theme, sauf quand il porte son
        // propre verre.
        drawerStyle: glassEnabled ? { backgroundColor: "transparent" } : undefined,
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
