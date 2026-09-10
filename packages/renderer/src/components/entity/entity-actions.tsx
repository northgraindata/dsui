import type { EntityAction } from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { RendererClient } from "../../types/renderer-types";
import { WorkbenchIcon } from "../icons";
import { EntityDialog } from "./entity-dialog";
import { EntityIcon } from "./entity-display";

const Actions = createContext<{
  busy: boolean;
  run(action: EntityAction): void;
} | null>(null);

export function EntityActions({
  client,
  refresh,
  selectTab,
  children,
}: PropsWithChildren<{
  client: RendererClient;
  refresh(): void;
  selectTab?(id: string): void;
}>) {
  const [confirmation, setConfirmation] = useState<EntityAction>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string }>();
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const execute = async (spec: EntityAction) => {
    if (!spec.action || running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await client.executeAction(spec.action);
      if (result.status !== "success")
        throw new Error(result.message ?? "Action failed");
      if (mounted.current) {
        setMessage({ error: false, text: `${spec.label} completed.` });
        setConfirmation(undefined);
      }
    } catch (cause) {
      if (mounted.current)
        setMessage({
          error: true,
          text: cause instanceof Error ? cause.message : "Action failed",
        });
    } finally {
      running.current = false;
      if (mounted.current) {
        setBusy(false);
        refresh();
      }
    }
  };
  const run = (spec: EntityAction) => {
    if (spec.disabledReason || running.current) return;
    if (spec.link) client.navigate(spec.link);
    else if (spec.tab) selectTab?.(spec.tab);
    else if (spec.confirmation) {
      setMessage(undefined);
      setConfirmation(spec);
    } else void execute(spec);
  };
  return (
    <Actions.Provider value={{ busy, run }}>
      {message && !confirmation && (
        <p
          className="entity-feedback"
          data-error={message.error}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      {children}
      {confirmation?.confirmation && (
        <EntityDialog
          title={confirmation.confirmation.title}
          description={confirmation.confirmation.description}
          close={() => {
            if (!running.current) setConfirmation(undefined);
          }}
        >
          {message && (
            <p
              role="alert"
              className="entity-feedback"
              data-error={message.error}
            >
              {message.text}
            </p>
          )}
          <div className="entity-dialog-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmation(undefined)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => void execute(confirmation)}
            >
              {busy ? "Restarting…" : confirmation.confirmation.confirmLabel}
            </Button>
          </div>
        </EntityDialog>
      )}
    </Actions.Provider>
  );
}

export function EntityActionButton({
  action,
  tile = false,
}: {
  action: EntityAction;
  tile?: boolean;
}) {
  const context = useContext(Actions);
  const id = useId();
  return (
    <>
      <Button
        type="button"
        className={tile ? "entity-action-tile" : "entity-action"}
        variant={action.primary ? "default" : "secondary"}
        disabled={Boolean(action.disabledReason) || context?.busy}
        aria-describedby={action.disabledReason ? id : undefined}
        title={action.disabledReason}
        onClick={() => context?.run(action)}
      >
        {action.icon && (
          <span className="entity-action-icon">
            <EntityIcon name={action.icon} size={tile ? 20 : 16} />
          </span>
        )}
        <span>
          {action.label}
          {tile && action.description && <small>{action.description}</small>}
        </span>
      </Button>
      {action.disabledReason && (
        <span id={id} className="sr-only">
          {action.disabledReason}
        </span>
      )}
    </>
  );
}

export function EntityMore({
  actions,
  title,
}: {
  actions: EntityAction[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="entity-more"
        aria-label={`More actions for ${title}`}
        onClick={() => setOpen(true)}
      >
        <WorkbenchIcon name="more" />
      </Button>
      {open && (
        <EntityDialog title={`${title} actions`} close={() => setOpen(false)}>
          <div className="entity-menu-actions">
            {actions.map((action) => (
              <EntityActionButton key={action.label} action={action} />
            ))}
          </div>
        </EntityDialog>
      )}
    </>
  );
}
