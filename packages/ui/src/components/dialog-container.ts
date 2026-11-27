import { useState } from "react";

/**
 * A modal `<dialog>` is drawn above the whole page and makes everything outside
 * it inert, so an overlay opened from inside one has to be rendered inside it.
 * Elsewhere overlays go to body.
 */
export function useDialogContainer() {
  const [container, setContainer] = useState<HTMLElement>();
  const ref = (element: HTMLElement | null) => {
    const dialog = element?.closest("dialog") ?? undefined;
    if (dialog !== container) setContainer(dialog);
  };
  return { container, ref };
}
