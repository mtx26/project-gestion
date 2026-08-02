import { useLocalSearchParams } from "expo-router";
import { TaskFormScreen } from "../../../../src/features/tasks/screens/TaskFormScreen";

export default function EditTaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskFormScreen mode="edit" taskId={Number(id)} />;
}
