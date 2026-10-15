import { permissionCodes } from "@project-gestion/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { DrawerContentScrollView } from "expo-router/drawer";
import { GlassSurface } from "../ui/GlassSurface";
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Lock,
  LogOut,
  Plus,
  Star,
  Settings,
  SquareLibrary,
  Trash2,
  UserRound,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useProjectPermissions } from "../../features/projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../features/projects/hooks/use-selected-project";
import { useUpdateAccount } from "../../features/account/hooks/use-account";
import { useAuthStore } from "../../stores/auth-store";
import { theme, useThemeColors } from "../../theme";

interface NavItem {
  key: string;
  route: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  locked: boolean;
}

/** Meme ambre que l'etoile du web (`fill-amber-400`). Il tient sur fond clair
 * comme sur fond sombre, donc pas de declinaison. */
const FAVORITE_COLOR = "#fbbf24";

export function ProjectDrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const updateAccount = useUpdateAccount();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const defaultProjectId = user?.profile?.default_project ?? null;
  const [projectListOpen, setProjectListOpen] = useState(false);
  const { projects, selectedProject, selectedProjectId, selectProject, isLoading } =
    useSelectedProject();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);

  const navItems: NavItem[] = [
    { key: "dashboard", route: "/", label: "Dashboard", icon: LayoutDashboard, locked: false },
    {
      key: "files",
      route: "/files",
      label: "Projet",
      icon: SquareLibrary,
      locked: Boolean(selectedProject && !can(permissionCodes.fileView)),
    },
    {
      key: "calendar",
      route: "/calendar",
      label: "Calendrier",
      icon: CalendarDays,
      locked: Boolean(
        selectedProject && !can(permissionCodes.taskView) && !can(permissionCodes.timeEntryView),
      ),
    },
    {
      key: "tasks",
      route: "/tasks",
      label: "Taches",
      icon: ListTodo,
      locked: Boolean(selectedProject && !can(permissionCodes.taskView)),
    },
    {
      key: "time",
      route: "/time",
      label: "Temps",
      icon: Clock3,
      locked: Boolean(selectedProject && !can(permissionCodes.timeEntryView)),
    },
    {
      key: "finance",
      route: "/finance",
      label: "Finances",
      icon: Banknote,
      locked: Boolean(selectedProject && !can(permissionCodes.financeView)),
    },
    {
      key: "requests",
      route: "/requests",
      label: "Remboursements",
      icon: ClipboardList,
      locked: Boolean(selectedProject && !can(permissionCodes.expenseRequestView)),
    },
    { key: "trash", route: "/trash", label: "Corbeille", icon: Trash2, locked: false },
    { key: "settings", route: "/settings", label: "Parametres projet", icon: Settings, locked: false },
  ];

  function goTo(route: string) {
    router.push(route as never);
    props.navigation.closeDrawer();
  }

  function onSelectProject(id: number) {
    selectProject(id);
    setProjectListOpen(false);
    props.navigation.closeDrawer();
  }

  async function onLogout() {
    await logout();
    // Comme sur le web : purger les donnees du compte precedent, sinon elles
    // restent visibles au prochain login sur le meme appareil.
    queryClient.clear();
    selectProject("");
  }

  return (
    // Le panneau glisse par-dessus le contenu : c'est la couche de navigation,
    // donc l'endroit ou le verre a un sens. Le repli reprend le fond que le
    // navigateur appliquait auparavant.
    <GlassSurface style={{ flex: 1 }} fallbackClassName="flex-1 bg-surface">
      <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 px-2">
          <Pressable
            onPress={() => setProjectListOpen((open) => !open)}
            accessibilityRole="button"
            className="mb-2 flex-row items-center gap-3 rounded-md p-3"
            android_ripple={{ color: `${theme.colors.foreground}1f` }}
          >
            <View className="h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Text className="text-sm font-semibold text-primary">
                {isLoading ? "" : (selectedProject?.name.charAt(0).toUpperCase() ?? "?")}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="truncate text-sm font-medium text-foreground" numberOfLines={1}>
                {isLoading ? "Chargement..." : (selectedProject?.name ?? "Aucun projet")}
              </Text>
              {selectedProject ? (
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {user && selectedProject.owner !== user.id
                    ? `Partage par ${selectedProject.owner_display_name}`
                    : "Mon projet"}
                </Text>
              ) : null}
            </View>
            <ChevronDown size={theme.iconSize.md} color={theme.colors.muted} />
          </Pressable>

          {projectListOpen ? (
            <View className="mb-2 gap-1 rounded-md border border-border bg-surface p-2">
              {projects.map((project) => (
                <View key={project.id} className="flex-row items-center">
                  <Pressable
                    onPress={() => onSelectProject(project.id)}
                    accessibilityRole="button"
                    className={`flex-1 flex-row items-center gap-2 rounded-md p-2 ${
                      String(project.id) === selectedProjectId ? "bg-primary/10" : ""
                    }`}
                    android_ripple={{ color: `${colors.foreground}1f` }}
                  >
                    <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                      {project.name}
                    </Text>
                  </Pressable>
                  {/* Le projet par defaut se marque ici, au meme endroit que sur le
                      web (etoile dans la liste des projets) plutot que dans les
                      reglages du compte. */}
                  <Pressable
                    onPress={() =>
                      updateAccount.mutate({
                        profile: {
                          default_project: project.id === defaultProjectId ? null : project.id,
                        },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: project.id === defaultProjectId }}
                    accessibilityLabel={
                      project.id === defaultProjectId
                        ? `${project.name} est le projet par defaut`
                        : `Definir ${project.name} par defaut`
                    }
                    hitSlop={8}
                    className="h-11 w-11 items-center justify-center"
                  >
                    <Star
                      size={theme.iconSize.sm}
                      color={project.id === defaultProjectId ? FAVORITE_COLOR : colors.muted}
                      fill={project.id === defaultProjectId ? FAVORITE_COLOR : "transparent"}
                    />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => {
                  setProjectListOpen(false);
                  router.push("/projects/create");
                }}
                accessibilityRole="button"
                className="flex-row items-center gap-2 rounded-md p-2"
                android_ripple={{ color: `${theme.colors.foreground}1f` }}
              >
                <Plus size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="text-sm text-muted">Ajouter un projet</Text>
              </Pressable>
            </View>
          ) : null}

          <View className="my-2 h-px bg-border" />

          <View className="gap-1">
            {navItems.map((item) => (
              <Pressable
                key={item.key}
                disabled={item.locked}
                onPress={() => goTo(item.route)}
                accessibilityRole="button"
                accessibilityState={{ disabled: item.locked }}
                className={`min-h-[44px] flex-row items-center gap-3 rounded-md px-3 py-2 ${item.locked ? "opacity-50" : ""}`}
                android_ripple={item.locked ? undefined : { color: `${theme.colors.foreground}1f` }}
              >
                <item.icon size={theme.iconSize.md} color={theme.colors.foreground} />
                <Text className="flex-1 text-sm text-foreground">{item.label}</Text>
                {item.locked ? <Lock size={theme.iconSize.sm} color={theme.colors.muted} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-1 border-t border-border px-2 pt-2">
          <Pressable
            onPress={() => router.push("/account")}
            accessibilityRole="button"
            className="min-h-[44px] flex-row items-center gap-3 rounded-md px-3 py-2"
            android_ripple={{ color: `${theme.colors.foreground}1f` }}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <UserRound size={theme.iconSize.md} color={theme.colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username}
              </Text>
              <Text className="text-xs text-muted" numberOfLines={1}>
                {user?.email ?? "Parametres"}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={onLogout}
            accessibilityRole="button"
            className="min-h-[44px] flex-row items-center gap-3 rounded-md px-3 py-2"
            android_ripple={{ color: `${theme.colors.foreground}1f` }}
          >
            <LogOut size={theme.iconSize.md} color={theme.colors.danger} />
            <Text className="text-sm text-danger">Deconnexion</Text>
          </Pressable>
        </View>
      </DrawerContentScrollView>
    </GlassSurface>
  );
}
