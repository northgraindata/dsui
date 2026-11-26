import * as Dialog from "@radix-ui/react-dialog";
import type { ModalProps } from "../kit";
import { keepOpenForToasts } from "./toast-events";

const close = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16">
    <path
      d="M6 6l12 12M18 6 6 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

/** A form starts in its first field, not on the close button before it. */
function focusFirstField(event: Event) {
  const field = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
    "input:not([type=hidden]), textarea, [role=combobox]",
  );
  if (!field) return;
  event.preventDefault();
  field.focus();
}

/**
 * The dialog for creating, editing and reading. Whether a click outside closes
 * it is the caller's choice and defaults to no, so typed input is not lost.
 * Escape and the close button always ask to close.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  closeOnOutsideClick = false,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dsui-modal-overlay" />
        <Dialog.Content
          className="dsui-modal"
          {...(description ? {} : { "aria-describedby": undefined })}
          onPointerDownOutside={(event) => {
            if (!closeOnOutsideClick) event.preventDefault();
          }}
          onInteractOutside={keepOpenForToasts}
          onOpenAutoFocus={focusFirstField}
        >
          <header className="dsui-modal-header">
            <div>
              <Dialog.Title className="dsui-modal-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="dsui-modal-description">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="dsui-modal-close" aria-label="Close">
              {close}
            </Dialog.Close>
          </header>
          <div className="dsui-modal-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
