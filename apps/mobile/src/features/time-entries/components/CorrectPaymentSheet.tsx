import { zodResolver } from "@hookform/resolvers/zod";
import type { TimeEntry } from "@project-gestion/types";
import { makeCorrectionSchema, type CorrectionFormValues } from "@project-gestion/validation";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";

interface CorrectPaymentSheetProps {
  /** `null` ferme la feuille. Monter une instance par entree (`key={entry?.id}`) :
   * le schema est borne par le cout et le montant deja paye de cette entree-la. */
  entry: TimeEntry | null;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (amount: string) => void;
}

/** Correction du montant deja paye d'une entree — le serveur cree l'ecriture
 * financiere (depense ou remboursement) correspondant a la difference. */
export function CorrectPaymentSheet({ entry, isPending, error, onClose, onSubmit }: CorrectPaymentSheetProps) {
  const costAmount = Number(entry?.cost_amount ?? 0);
  const paidAmount = entry?.paid_amount ?? "0";

  const form = useForm<CorrectionFormValues>({
    resolver: zodResolver(makeCorrectionSchema(costAmount, Number(paidAmount))),
    defaultValues: { amount: paidAmount },
  });

  useServerFieldErrors(form, error, ["amount"]);

  return (
    <BottomSheet visible={entry != null} title="Corriger le paiement" onClose={onClose}>
      <Text className="text-sm text-muted">
        Actuellement paye : {formatMoney(paidAmount)} sur {formatMoney(costAmount)}.
      </Text>

      <InlineMessage variant="danger">{getErrorMessage(error)}</InlineMessage>

      <Controller
        control={form.control}
        name="amount"
        render={({ field, fieldState }) => (
          <FormField
            label="Nouveau montant paye (EUR)"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        )}
      />

      <Text className="text-xs text-muted">
        Une entree de correction (depense ou remboursement) sera creee pour la difference.
      </Text>

      <View className="pt-1">
        <Button onPress={form.handleSubmit((values) => onSubmit(values.amount))} disabled={isPending}>
          {isPending ? "Correction..." : "Corriger"}
        </Button>
      </View>
    </BottomSheet>
  );
}
