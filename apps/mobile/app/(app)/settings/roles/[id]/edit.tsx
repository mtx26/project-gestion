import { useLocalSearchParams } from "expo-router";
import { RoleFormScreen } from "../../../../../src/features/settings/screens/RoleFormScreen";

export default function EditRoleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RoleFormScreen mode="edit" roleId={Number(id)} />;
}
