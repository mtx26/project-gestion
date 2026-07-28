import { permissionCodes } from "@project-gestion/permissions";
import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function FilesScreen() {
  return (
    <ProjectSectionScreen title="Fichiers" requiredPermission={permissionCodes.fileView}>
      {(project) => (
        <Text className="text-sm text-muted">
          Dossiers et documents de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
