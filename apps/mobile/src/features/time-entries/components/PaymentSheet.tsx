import { zodResolver } from "@hookform/resolvers/zod";
import type { TimeEntry } from "@project-gestion/types";
import { makePaymentSchema, type PaymentFormValues } from "@project-gestion/validation";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";

interface PaymentSheetProps {
  /** `null` ferme la feuille. Monter une instance par entree (`key={entry?.id}`) :
   * le schema est borne par le reste a payer de cette entree-la. */
  entry: TimeEntry | null;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (values: { mode: "full" | "partial"; amount: string }) => void;
}

/** Paiement d'une entree : tout le reste, ou un montant partiel. */
export function PaymentSheet({ entry, isPending, error, onClose, onSubmit }: PaymentSheetProps) {
  const remainingAmount = Number(entry?.remaining_amount ?? 0);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(makePaymentSchema(remainingAmount)),
    defaultValues: { mode: "full", amount: entry?.remaining_amount ?? "" },
  });

  useServerFieldErrors(form, error, ["amount"]);

  const mode = form.watch("mode");

  return (
    <BottomSheet visible={entry != null} title="Marquer comme paye" onClose={onClose}>
      <Text className="text-sm text-muted">Reste a payer : {formatMoney(remainingAmount)}.</Text>

      <InlineMessage variant="danger">{getErrorMessage(error)}</InlineMessage>

      <Controller
        control={form.control}
        name="mode"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel="Type de paiement"
            options={[
              { label: "Tout le reste", value: "full" },
              { label: "Partiel", value: "partial" },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {mode === "partial" ? (
        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <FormField
              label="Montant paye (EUR)"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          )}
        />
      ) : null}

      <View className="pt-1">
        <Button onPress={form.handleSubmit(onSubmit)} disabled={isPending || remainingAmount <= 0}>
          {isPending ? "Paiement..." : "Confirmer"}
        </Button>
      </View>
    </BottomSheet>
  );
}
