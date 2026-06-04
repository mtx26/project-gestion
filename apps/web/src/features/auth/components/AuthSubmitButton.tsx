interface AuthSubmitButtonProps {
  disabled: boolean;
  label: string;
}

export function AuthSubmitButton({ disabled, label }: AuthSubmitButtonProps) {
  return (
    <button type="submit" disabled={disabled}>
      {label}
    </button>
  );
}
