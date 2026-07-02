import { Button } from "@/components/ui/button";

interface FormSubmitButtonProps {
  /** Id du <form> a soumettre, si le bouton est rendu en dehors du <form>. */
  form?: string;
  pending?: boolean;
  disabled?: boolean;
  label: string;
  pendingLabel: string;
  onClick?: () => void;
}

/** Bouton de soumission dont le libelle bascule pendant l'envoi. */
export function FormSubmitButton({ form, pending, disabled, label, pendingLabel, onClick }: FormSubmitButtonProps) {
  return (
    <Button type={onClick ? "button" : "submit"} form={form} onClick={onClick} disabled={disabled || pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
