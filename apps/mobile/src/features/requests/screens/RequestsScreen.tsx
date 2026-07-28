import { permissionCodes } from "@project-gestion/permissions";
import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function RequestsScreen() {
  return (
    <ProjectSectionScreen title="Remboursements" requiredPermission={permissionCodes.expenseRequestView}>
      {(project) => (
        <Text className="px-5 text-sm text-muted">
          Notes de frais de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
