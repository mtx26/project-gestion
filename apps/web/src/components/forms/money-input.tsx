import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

type MoneyInputProps = Omit<ComponentProps<typeof Input>, "type" | "inputMode"> & {
  /** Unité affichée en suffixe (ex: "€/h" pour un taux horaire), pour lever
   * l'ambiguïté sur ce que représente le montant. Omis pour un montant simple. */
  unit?: string;
};

/** Text input for a monetary amount — accepts a comma decimal separator (see amountSchema). */
export function MoneyInput({ unit, className, ...props }: MoneyInputProps) {
  if (!unit) {
    return <Input type="text" inputMode="decimal" placeholder="0.00" className={className} {...props} />;
  }

  return (
    <InputGroup className={className}>
      <InputGroupInput type="text" inputMode="decimal" placeholder="0.00" {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{unit}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}
