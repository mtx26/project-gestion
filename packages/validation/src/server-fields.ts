import type { FieldValues, Path } from "react-hook-form";

/** A form field name, or a form field paired with the API's field name for
 * it when they differ (e.g. `startDate` in the form vs `start_date` from
 * Django) — the shape `useServerFieldErrors` (web and mobile) consumes to
 * map a 400 response's field errors onto the right input. Field-mapping
 * arrays live next to each domain's schema below so both apps import the
 * same list instead of hand-copying it per platform. */
export type FieldMapping<T extends FieldValues> = Path<T> | { name: Path<T>; serverField: string };
