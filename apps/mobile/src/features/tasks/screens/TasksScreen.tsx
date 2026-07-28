import { permissionCodes } from "@project-gestion/permissions";
import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function TasksScreen() {
  return (
    <ProjectSectionScreen title="Taches" requiredPermission={permissionCodes.taskView}>
      {(project) => (
        <Text className="text-sm text-muted">
          Taches de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
