import { permissionCodes } from "@project-gestion/permissions";
import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function TimeScreen() {
  return (
    <ProjectSectionScreen title="Temps" requiredPermission={permissionCodes.timeEntryView}>
      {(project) => (
        <Text className="text-sm text-muted">
          Suivi du temps de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
