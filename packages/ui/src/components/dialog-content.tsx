import * as Dialog from "@radix-ui/react-dialog";
import type { PropsWithChildren } from "react";

export function DialogContent({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/85" />
      <Dialog.Content className="fixed top-1/2 left-1/2 z-[51] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 border border-border-strong bg-surface-raised p-5 ring-1 ring-accent/10">
        <div className="mb-[18px] flex justify-between gap-5 border-b border-dashed border-border pb-[14px]">
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            {description ? (
              <Dialog.Description>{description}</Dialog.Description>
            ) : null}
          </div>
          <Dialog.Close
            className="border-0 bg-transparent text-[22px] leading-none text-secondary"
            aria-label="Close"
          >
            ×
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
