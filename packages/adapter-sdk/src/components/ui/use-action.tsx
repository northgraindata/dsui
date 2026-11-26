import { ConfirmDialog, notify } from "@northgraindata/dsui-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** How long a button keeps showing that its last run failed. */
const FAILED_MS = 4000;

export interface Confirmation {
  title: string;
  description: string;
  confirmLabel?: string;
}

export interface ActionRequest {
  /** Identifies the failure, so repeating it updates one toast. */
  id: string;
  label: string;
  confirmation?: Confirmation;
  /** Values for `{field}` placeholders in the confirmation. */
  values?: Readonly<Record<string, unknown>>;
  destructive?: boolean;
  /** Resolves to an error message when the action fails. */
  perform: () => Promise<string | undefined>;
}

/** Replaces `{field}` with the value, so a dialog can name its object. */
export function fillTemplate(
  text: string,
  values: Readonly<Record<string, unknown>> = {},
): string {
  return text.replace(/\{([A-Za-z0-9_.]+)\}/g, (whole, field: string) => {
    const value = field
      .split(".")
      .reduce<unknown>(
        (current, key) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[key]
            : undefined,
        values,
      );
    return value === undefined || value === null ? whole : String(value);
  });
}

/**
 * The one way a control runs an action: it asks first when the action declares
 * a confirmation, blocks a second run while pending, and reports a failure in a
 * toast, so no error text changes the size of the control.
 */
export function useAction() {
  const [asking, setAsking] = useState<ActionRequest>();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), FAILED_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  const execute = async (request: ActionRequest): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    setFailed(false);
    let message: string | undefined;
    try {
      message = await request.perform();
    } catch (cause) {
      message = cause instanceof Error ? cause.message : "Action failed";
    }
    running.current = false;
    setPending(false);
    if (message === undefined) return true;
    setFailed(true);
    notify.error(`${request.label} failed`, {
      id: request.id,
      description: message,
    });
    return false;
  };

  const run = (request: ActionRequest) => {
    if (request.confirmation) setAsking(request);
    else void execute(request);
  };

  const confirmation = asking?.confirmation;
  const dialog: ReactNode = confirmation ? (
    // React events cross portals, so a click here must not reach a row.
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops bubbling
    // biome-ignore lint/a11y/useKeyWithClickEvents: only stops bubbling
    <span onClick={(event) => event.stopPropagation()}>
      <ConfirmDialog
        open
        onOpenChange={(open) => {
          if (!open) setAsking(undefined);
        }}
        title={fillTemplate(confirmation.title, asking.values)}
        description={fillTemplate(confirmation.description, asking.values)}
        confirmLabel={confirmation.confirmLabel ?? asking.label}
        tone={asking.destructive ? "danger" : "default"}
        onConfirm={async () => {
          // Throwing keeps the dialog open for another try.
          if (!(await execute(asking))) throw new Error("Action failed");
        }}
      />
    </span>
  ) : null;

  return { run, pending, failed, dialog };
}
