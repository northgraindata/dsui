import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import type { ConfirmDialogProps } from "../kit";
import { Button } from "./button";

/**
 * Asks before an action with consequences. A click outside never dismisses it.
 * While `onConfirm` is pending both buttons are blocked. It closes when the
 * action succeeds, and stays open when it throws so the person can retry; the
 * caller reports the failure.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The dialog stays; reporting the failure belongs to the caller.
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dsui-confirm-overlay" />
        <AlertDialog.Content className="dsui-confirm">
          <AlertDialog.Title className="dsui-confirm-title">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="dsui-confirm-description">
            {description}
          </AlertDialog.Description>
          <div className="dsui-confirm-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {/* Not AlertDialog.Action, which would close before the result. */}
            <Button
              variant={tone === "danger" ? "danger" : "default"}
              className="dsui-confirm-action"
              data-pending={pending}
              aria-busy={pending}
              disabled={pending}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
