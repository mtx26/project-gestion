import { useLocalSearchParams } from "expo-router";
import { FinancialEntryFormScreen } from "../../../../src/features/finance/screens/FinancialEntryFormScreen";

export default function EditFinancialEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <FinancialEntryFormScreen mode="edit" entryId={Number(id)} />;
}
