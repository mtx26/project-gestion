import type { AuthActionResult } from "./types";

export async function runAuthAction(
  setLoading: (loading: boolean) => void,
  setMessage: (message: string) => void,
  action: () => Promise<AuthActionResult>
) {
  setLoading(true);
  setMessage("");

  const result = await action();

  setLoading(false);
  setMessage(result.message);

  return result;
}
