"use client";

import { getFieldError } from "@project-gestion/api";
import type { FieldMapping } from "@project-gestion/validation";
import { useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/** Maps a mutation's ApiError.fieldErrors onto react-hook-form fields, so a 400 response
 * surfaces under the right input instead of only in the dialog's generic alert.
 *
 * Accepts `UseFormReturn<T, any, any>` (not just `UseFormReturn<T>`) so it also works
 * with a form whose Zod schema transforms its output to a different shape (`useForm<Input,
 * Context, Output>`) — `setError` always targets the *input* field names (`T`), regardless
 * of what the resolver eventually returns on submit. */
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
