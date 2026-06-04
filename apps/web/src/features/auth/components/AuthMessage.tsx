interface AuthMessageProps {
  message: string;
}

export function AuthMessage({ message }: AuthMessageProps) {
  if (!message) {
    return null;
  }

  return <p>{message}</p>;
}
