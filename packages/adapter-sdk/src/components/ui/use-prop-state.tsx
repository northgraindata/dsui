import { type Dispatch, type SetStateAction, useState } from "react";

/**
 * State that starts from a prop and starts over when the prop changes.
 *
 * Nodes keep their identity across re-renders, so a plain `useState(prop)`
 * would keep showing the first value after the page sends a new one. While the
 * prop stays the same, what the person changed is kept.
 *
 * Pass the prop itself, not a copy: a new object on every render would reset
 * the state on every render.
 */
export function usePropState<T>(prop: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(prop);
  const [seen, setSeen] = useState(() => prop);
  if (!Object.is(seen, prop)) {
    setSeen(() => prop);
    setState(() => prop);
    return [prop, setState];
  }
  return [state, setState];
}
