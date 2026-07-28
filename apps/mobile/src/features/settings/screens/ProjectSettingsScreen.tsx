import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function ProjectSettingsScreen() {
  return (
    <ProjectSectionScreen title="Parametres projet">
      {(project) => (
        <Text className="text-sm text-muted">
          Membres et roles de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
