import { ConfirmDialog, Modal } from "@northgraindata/dsui-ui";
import { createContext, Fragment, useRef, useState } from "react";
import type { DialogSpec } from "../primitives/dialog";
import type { ComponentProps } from "../runtime";
import { positioned } from "./keys";
import { fillTemplate } from "./use-action";

export interface FormHost {
  /** Closes the dialog once the form's work is done. */
  done: () => void;
  /** The person closing the dialog by choice; asks if input would be lost. */
  cancel: () => void;
  setDirty: (dirty: boolean) => void;
}

/** Set when a form is shown in a dialog rather than on a page. */
export const FormHostContext = createContext<FormHost | null>(null);

/** Renders a declared dialog. Closing with unsaved input asks first. */
export function SpecDialog({
  spec,
  values,
  onClose,
  client,
  renderNode,
}: {
  spec: DialogSpec;
  values: Record<string, unknown>;
  onClose: () => void;
} & Pick<ComponentProps, "client" | "renderNode">) {
  const dirty = useRef(false);
  const [discarding, setDiscarding] = useState(false);
  const cancel = () => {
    if (dirty.current) setDiscarding(true);
    else onClose();
  };
  const content = Array.isArray(spec.content) ? spec.content : [spec.content];
  return (
    // React events cross portals, so a click here must not reach a row.
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops bubbling
    // biome-ignore lint/a11y/useKeyWithClickEvents: only stops bubbling
    <span onClick={(event) => event.stopPropagation()}>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
        title={fillTemplate(spec.title, values)}
        description={spec.description && fillTemplate(spec.description, values)}
        closeOnOutsideClick={spec.closeOnOutsideClick}
      >
        <FormHostContext.Provider
          value={{
            done: onClose,
            cancel,
            setDirty: (next) => {
              dirty.current = next;
            },
          }}
        >
          {positioned(content).map(({ item, key }) => (
            <Fragment key={key}>{renderNode(client, item, values)}</Fragment>
          ))}
        </FormHostContext.Provider>
      </Modal>
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard changes?"
        description="What you entered has not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={onClose}
      />
    </span>
  );
}
