import type { FieldValues } from "react-hook-form";

/** A form field name, or a form field paired with the API's field name for
 * it when they differ (e.g. `startDate` in the form vs `start_date` from
 * Django) — the shape `useServerFieldErrors` (web and mobile) consumes to
 * map a 400 response's field errors onto the right input. Field-mapping
 * arrays live next to each domain's schema below so both apps import the
 * same list instead of hand-copying it per platform.
 *
 * Uses `keyof T` rather than react-hook-form's `Path<T>` — every mapping in
 * this app targets a top-level field (never a nested `"a.b.c"` path), and
 * `Path<T>` is a deeply recursive conditional type across every nested
 * object/array/tuple shape; instantiating it repeatedly (once per form,
 * across every screen that imports `@project-gestion/validation`) is what
 * was making `tsc` take 10+ minutes on this package. */
export type FieldMapping<T extends FieldValues> =
  | Extract<keyof T, string>
  | { name: Extract<keyof T, string>; serverField: string };
