import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function TrashScreen() {
  return (
    <ProjectSectionScreen title="Corbeille">
      {(project) => (
        <Text className="text-sm text-muted">
          Elements supprimes de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
