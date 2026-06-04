interface AuthEmailInputProps {
  value: string;
  onChange(value: string): void;
}

export function AuthEmailInput({ value, onChange }: AuthEmailInputProps) {
  return (
    <p>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoComplete="email"
      />
    </p>
  );
}
