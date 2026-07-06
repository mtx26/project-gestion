import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type MoneyInputProps = Omit<ComponentProps<typeof Input>, "type" | "inputMode">;

/** Text input for a monetary amount — accepts a comma decimal separator (see amountSchema). */
export function MoneyInput(props: MoneyInputProps) {
  return <Input type="text" inputMode="decimal" placeholder="0.00" {...props} />;
}
