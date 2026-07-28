import { permissionCodes } from "@project-gestion/permissions";
import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function CalendarScreen() {
  return (
    <ProjectSectionScreen
      title="Calendrier"
      requiredPermission={(can) => can(permissionCodes.taskView) || can(permissionCodes.timeEntryView)}
    >
      {(project) => (
        <Text className="text-sm text-muted">
          Vue calendrier de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
