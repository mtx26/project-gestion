import { zodResolver } from "@hookform/resolvers/zod";
import { makeBulkPaymentSchema, type BulkPaymentFormValues } from "@project-gestion/validation";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { SelectFilterPill } from "../../../components/filters/SelectFilterPill";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";

export interface BulkPaymentPayee {
  userId: number;
  name: string;
  remainingAmount: number;
}

interface BulkPaymentSheetProps {
  visible: boolean;
  scopeLabel: string;
  /** Membres ayant un reste a payer dans le scope courant (`by_user` des stats). */
  payees: BulkPaymentPayee[];
  defaultPayeeId: number | null;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (values: { userId: number; amount: string }) => void;
}

/** Paiement groupe : on choisit un membre, puis un montant que le serveur repartit
 * sur ses entrees du scope courant (memes filtres que la synthese), de la plus
 * ancienne a la plus recente. Monter une instance par ouverture (`key`) pour repartir
 * des restes a payer courants. */
export function BulkPaymentSheet({
  visible,
  scopeLabel,
  payees,
  defaultPayeeId,
  isPending,
  error,
  onClose,
  onSubmit,
}: BulkPaymentSheetProps) {
  const initialPayee =
    payees.find((payee) => payee.userId === defaultPayeeId) ?? (payees.length === 1 ? payees[0] : null);
  const remainingByUserId = Object.fromEntries(payees.map((payee) => [String(payee.userId), payee.remainingAmount]));

  const form = useForm<BulkPaymentFormValues>({
    resolver: zodResolver(makeBulkPaymentSchema(remainingByUserId)),
    defaultValues: {
      userId: initialPayee ? String(initialPayee.userId) : "",
      amount: initialPayee ? initialPayee.remainingAmount.toFixed(2) : "",
    },
  });

  useServerFieldErrors(form, error, ["amount", { name: "userId", serverField: "user" }]);

  const selectedUserId = form.watch("userId");
  const selectedPayee = payees.find((payee) => String(payee.userId) === selectedUserId) ?? null;

  return (
    <BottomSheet visible={visible} title="Payer un membre" onClose={onClose}>
      {payees.length === 0 ? (
        <EmptyState
          title="Rien a payer"
          description="Aucun membre n'a de reste a payer dans cette selection."
        />
      ) : (
        <>
          <Text className="text-sm text-muted">
            {selectedPayee
              ? `${scopeLabel} — reste a payer a ${selectedPayee.name} : ${formatMoney(selectedPayee.remainingAmount)}.`
              : `${scopeLabel} — choisis le membre a payer.`}
          </Text>

          <InlineMessage variant="danger">{getErrorMessage(error)}</InlineMessage>

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Membre a payer</Text>
            <SelectFilterPill
              label={selectedPayee ? selectedPayee.name : "Choisir un membre"}
              title="Membre a payer"
              options={payees.map((payee) => ({
                label: `${payee.name} — ${formatMoney(payee.remainingAmount)}`,
                value: String(payee.userId),
              }))}
              value={selectedUserId}
              onSelect={(value) => {
                form.setValue("userId", value, { shouldValidate: true });
                const payee = payees.find((row) => String(row.userId) === value);
                form.setValue("amount", payee ? payee.remainingAmount.toFixed(2) : "");
              }}
            />
            {form.formState.errors.userId ? (
              <Text className="text-sm text-danger" accessibilityRole="alert">
                {form.formState.errors.userId.message}
              </Text>
            ) : null}
          </View>

          <Controller
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <FormField
                label="Montant a payer (EUR)"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            )}
          />

          <Text className="text-xs text-muted">
            Le montant est reparti de l'entree la plus ancienne a la plus recente : chacune est soldee
            entierement tant que le montant le permet, seule la derniere servie pouvant l'etre partiellement.
          </Text>

          <View className="pt-1">
            <Button
              onPress={form.handleSubmit((values) => onSubmit({ userId: Number(values.userId), amount: values.amount }))}
              disabled={isPending}
            >
              {isPending ? "Paiement..." : "Payer"}
            </Button>
          </View>
        </>
      )}
    </BottomSheet>
  );
}
