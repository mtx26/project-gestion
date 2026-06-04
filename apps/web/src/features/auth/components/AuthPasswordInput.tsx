interface AuthPasswordInputProps {
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange(value: string): void;
}

export function AuthPasswordInput({
  autoComplete,
  value,
  onChange,
}: AuthPasswordInputProps) {
  return (
    <p>
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={6}
        autoComplete={autoComplete}
      />
    </p>
  );
}
