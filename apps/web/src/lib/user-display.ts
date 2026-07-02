import type { ReactNode } from "react";

/** First letters of up to the first 2 words of `name`, or `emptyFallback` if blank. */
export function getInitials(name: string, emptyFallback: ReactNode = "U"): ReactNode {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return emptyFallback;
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
