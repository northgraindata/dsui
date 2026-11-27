/**
 * A toast sits above modals but outside their DOM. Without this check, a modal
 * would take a click on a toast for a click outside, and close.
 */
export function keepOpenForToasts(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) {
  if (
    event.target instanceof Element &&
    event.target.closest("[data-sonner-toaster]")
  )
    event.preventDefault();
}
