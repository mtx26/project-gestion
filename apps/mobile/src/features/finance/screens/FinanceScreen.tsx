import { permissionCodes } from "@project-gestion/permissions";
import { Text } from "react-native";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";

export function FinanceScreen() {
  return (
    <ProjectSectionScreen title="Finances" requiredPermission={permissionCodes.financeView}>
      {(project) => (
        <Text className="px-5 text-sm text-muted">
          Finances de « {project.name} » — a venir.
        </Text>
      )}
    </ProjectSectionScreen>
  );
}
