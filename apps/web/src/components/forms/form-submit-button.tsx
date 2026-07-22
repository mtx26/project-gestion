import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface FormSubmitButtonProps {
  /** Id du <form> a soumettre — requis quand le bouton est rendu en dehors du
   * <form> (le cas courant : footer de FormDialog). Omis quand le bouton est
   * un enfant direct du <form> (ex. account-profile-form.tsx). */
  form?: string;
  pending?: boolean;
  disabled?: boolean;
  label: string;
  pendingLabel: string;
}

/** Bouton de soumission dont le libelle bascule pendant l'envoi. Toujours
 * type="submit", declenche via la soumission native du <form> (Entree incluse)
 * — jamais un onClick qui appelle form.handleSubmit() a la main. */
export function FormSubmitButton({ form, pending, disabled, label, pendingLabel }: FormSubmitButtonProps) {
  return (
    <Button type="submit" form={form} disabled={disabled || pending}>
      {pending ? <Spinner /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}
