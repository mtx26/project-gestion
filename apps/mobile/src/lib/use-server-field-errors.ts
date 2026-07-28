import { getFieldError } from "@project-gestion/api";
import { useEffect } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

type FieldMapping<T extends FieldValues> = Path<T> | { name: Path<T>; serverField: string };

/** Maps a mutation's ApiError.fieldErrors onto react-hook-form fields, so a 400 response
 * surfaces under the right input instead of only in the screen's generic banner. */
export function useServerFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T, unknown, FieldValues>,
  error: unknown,
  fields: FieldMapping<T>[],
) {
  useEffect(() => {
    if (!error) return;
    for (const field of fields) {
      const name = typeof field === "string" ? field : field.name;
      const serverField = typeof field === "string" ? field : field.serverField;
      const message = getFieldError(error, serverField);
      if (message) form.setError(name, { message });
    }
    // form/fields are stable per mount; re-running only when a new error comes in is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
}
