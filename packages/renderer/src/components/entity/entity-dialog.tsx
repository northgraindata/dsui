import { Button } from "@northgraindata/dsui-ui";
import { type PropsWithChildren, useEffect, useId, useRef } from "react";
import { WorkbenchIcon } from "../icons";

export function EntityDialog({
  title,
  description,
  close,
  children,
}: PropsWithChildren<{ title: string; description?: string; close(): void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="entity-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="entity-dialog-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close dialog"
          onClick={close}
        >
          <WorkbenchIcon name="close" />
        </Button>
      </div>
      {description && <p id={`${id}-description`}>{description}</p>}
      {children}
    </dialog>
  );
}
