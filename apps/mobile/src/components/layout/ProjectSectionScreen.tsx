import type { PermissionCode, ProjectPermissionState } from "@project-gestion/permissions";
import type { Project } from "@project-gestion/types";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProjectPermissions } from "../../features/projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../features/projects/hooks/use-selected-project";
import { useAuthStore } from "../../stores/auth-store";
import { AccessDeniedState } from "../feedback/AccessDeniedState";
import { LoadingState } from "../feedback/LoadingState";
import { NoProjectState } from "../feedback/NoProjectState";

interface ProjectSectionScreenProps {
  title: string;
  requiredPermission?: PermissionCode | ((can: (code: PermissionCode) => boolean) => boolean);
  /** Children control their own scrolling (FlatList, ScrollView, or plain content) —
   * this wrapper only owns the safe area, title, and loading/no-project/locked states. */
  children: (project: Project) => ReactNode;
}

export function ProjectSectionScreen({
  title,
  requiredPermission,
  children,
}: ProjectSectionScreenProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { selectedProject, isLoading } = useSelectedProject();
  const { can } = useProjectPermissions(selectedProject as ProjectPermissionState | null, user?.id ?? null);

  const hasAccess = !requiredPermission
    ? true
    : typeof requiredPermission === "function"
      ? requiredPermission(can)
      : can(requiredPermission);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <Text className="px-5 pb-2 pt-6 text-2xl font-semibold text-foreground">{title}</Text>
      <View className="flex-1">
        {isLoading ? (
          <LoadingState />
        ) : !selectedProject ? (
          <View className="px-5">
            <NoProjectState
              description="Cree un projet depuis le menu pour commencer."
              onCreateProject={() => router.push("/projects/create")}
            />
          </View>
        ) : !hasAccess ? (
          <View className="px-5">
            <AccessDeniedState label={title} />
          </View>
        ) : (
          children(selectedProject)
        )}
      </View>
    </SafeAreaView>
  );
}
