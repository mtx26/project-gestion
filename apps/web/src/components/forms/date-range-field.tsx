import { Field, FieldLabel } from "@/components/ui/field";
import { DateTimePicker } from "@/components/forms/date-time-picker";

interface DateRangeFieldProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
}

/** Paire de dates cote a cote, avec min/max croises pour empecher debut > fin. */
export function DateRangeField({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = "Date de debut",
  endLabel = "Date de fin",
}: DateRangeFieldProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel>{startLabel}</FieldLabel>
        <DateTimePicker value={startValue} onChange={onStartChange} maxDate={endValue} />
      </Field>
      <Field>
        <FieldLabel>{endLabel}</FieldLabel>
        <DateTimePicker value={endValue} onChange={onEndChange} minDate={startValue} />
      </Field>
    </div>
  );
}
