"use client";

import { useRef, useState } from "react";

type FilterUpdate = (changes: Record<string, string | number | boolean | null | undefined>) => void;

export function useSearchParam(
  searchFromUrl: string,
  updateUrlFilter: FilterUpdate,
  delay = 400,
): readonly [string, (value: string) => void] {
  const [value, setValue] = useState(searchFromUrl);
  const [committed, setCommitted] = useState(searchFromUrl);
  if (committed !== searchFromUrl) {
    setCommitted(searchFromUrl);
    setValue(searchFromUrl);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(newValue: string) {
    setValue(newValue);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => updateUrlFilter({ search: newValue || null }), delay);
  }

  return [value, onChange] as const;
}
