import type { PermissionCode, ProjectPermissionState } from "@project-gestion/permissions";
import type { Project } from "@project-gestion/types";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProjectPermissions } from "../../features/projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../features/projects/hooks/use-selected-project";
import { useAuthStore } from "../../stores/auth-store";
import { AccessDeniedState } from "../feedback/AccessDeniedState";
import { LoadingState } from "../feedback/LoadingState";
import { NoProjectState } from "../feedback/NoProjectState";

interface ProjectSectionScreenProps {
  /** Only used for the access-denied message — the visible title comes from this
   * screen's Drawer.Screen `title` option (native header), not rendered here, so
   * the two never show up twice. */
  title: string;
  requiredPermission?: PermissionCode | ((can: (code: PermissionCode) => boolean) => boolean);
  /** Children control their own scrolling (FlatList, ScrollView, or plain content) —
   * this wrapper only owns the safe area and loading/no-project/locked states. */
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
    // No "top" edge: this screen already sits below the Drawer's native header,
    // which already accounts for the status bar — adding it here would double-pad.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <View className="flex-1 pt-4">
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
