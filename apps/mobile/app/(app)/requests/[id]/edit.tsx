import { useLocalSearchParams } from "expo-router";
import { RequestFormScreen } from "../../../../src/features/requests/screens/RequestFormScreen";

export default function EditRequestRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RequestFormScreen mode="edit" requestId={Number(id)} />;
}
