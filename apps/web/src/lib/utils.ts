import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Immutable toggle of a value's membership in a `Set` — returns a new `Set`,
 * leaving `set` untouched, for state updaters like `setExpanded(prev => toggleSetValue(prev, id))`. */
export function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Immutable "ensure present" add to a `Set` — returns a new `Set` with `value`
 * added, leaving `set` untouched (unlike `toggleSetValue`, never removes it). */
export function addToSet<T>(set: Set<T>, value: T): Set<T> {
  return new Set(set).add(value);
}
