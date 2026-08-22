import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value — search boxes, mainly. Search is server-side across
 * ~1,000 shops and ~2,300 people, so firing a request per keystroke is wasteful.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
