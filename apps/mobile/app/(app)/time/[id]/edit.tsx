import { useLocalSearchParams } from "expo-router";
import { TimeEntryFormScreen } from "../../../../src/features/time-entries/screens/TimeEntryFormScreen";

export default function EditTimeEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <TimeEntryFormScreen mode="edit" timeEntryId={Number(id)} />;
}
