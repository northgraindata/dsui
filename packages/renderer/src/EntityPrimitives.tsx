import type {
  EntityAction,
  EntityBadge,
  EntityItem,
  EntityPanel,
} from "@northgraindata/dsui-core";
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
import { WorkbenchIcon } from "./components/icons";
import type { RendererClient } from "./types";

export function EntityIcon({
  name = "layers",
  size = 22,
}: {
  name?: string;
  size?: number;
}) {
  return /^https?:\/\//i.test(name) ? (
    <img src={name} alt="" width={size} height={size} />
  ) : (
    <WorkbenchIcon name={name} size={size} />
  );
}
export function Badge({
  badge,
  dot = false,
}: {
  badge: EntityBadge;
  dot?: boolean;
}) {
  return (
    <span
      className={dot ? "entity-status" : "entity-badge"}
      data-tone={badge.tone ?? "muted"}
    >
      {dot && <i aria-hidden="true" />}
      {badge.label}
    </span>
  );
}

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

export function EntityCode({
  label,
  value,
  language,
}: {
  label: string;
  value: string;
  language?: "sql" | "text";
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  };
  const tokens =
    language === "sql"
      ? [
          ...value.matchAll(
            /'[^']*(?:''[^']*)*'|\b(?:SELECT|FROM|INSTALL|LOAD|CREATE|SECRET|TYPE|SET|AS|LIMIT|WHERE)\b|[^'\w]+|\w+|'/gi,
          ),
        ]
      : [];
  return (
    <div className="entity-code">
      <h3>{label}</h3>
      <div className="entity-code-box">
        <pre>
          <code>
            {language === "sql"
              ? tokens.map((match) => (
                  <span
                    key={match.index}
                    className={
                      match[0].startsWith("'")
                        ? "entity-sql-string"
                        : /^(SELECT|FROM|INSTALL|LOAD|CREATE|SECRET|TYPE|SET|AS|LIMIT|WHERE)$/i.test(
                              match[0],
                            )
                          ? "entity-sql-keyword"
                          : undefined
                    }
                  >
                    {match[0]}
                  </span>
                ))
              : value}
          </code>
        </pre>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={() => void copy()}
        >
          <WorkbenchIcon name={copied ? "check" : "copy"} />
        </Button>
      </div>
      <span className="sr-only" role="status">
        {copied
          ? "Copied to clipboard"
          : error
            ? "Could not copy. Select and copy the code manually."
            : ""}
      </span>
    </div>
  );
}

export function EntityMiniList({ items }: { items: EntityItem[] }) {
  return (
    <ul className="entity-mini-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className="entity-mini-icon">
            <EntityIcon name={item.icon} />
          </span>
          <div>
            <span>{item.title}</span>
            {item.description && <small>{item.description}</small>}
          </div>
          {item.detail && (
            <span className="entity-mini-detail">{item.detail}</span>
          )}
          {item.actions?.slice(0, 1).map((action) => (
            <EntityActionButton key={action.label} action={action} />
          ))}
        </li>
      ))}
    </ul>
  );
}
export function EntityPanelView({ panel }: { panel: EntityPanel }) {
  return (
    <section className="entity-panel">
      <h2>{panel.title}</h2>
      {panel.status && <Badge badge={panel.status} dot />}
      {panel.description && (
        <p className="entity-panel-description">{panel.description}</p>
      )}
      {panel.links && (
        <div className="entity-links">
          {panel.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              <EntityIcon name={link.icon ?? "file"} size={18} />
              {link.label}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      )}
      {panel.facts && (
        <dl className="entity-facts">
          {panel.facts.map((fact) => (
            <div key={fact.label}>
              <span className="entity-fact-icon">
                <EntityIcon name={fact.icon ?? "file"} size={19} />
              </span>
              <div>
                <dt>{fact.label}</dt>
                <dd data-tone={fact.tone}>{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
      {panel.actions && (
        <div
          className={
            panel.actions.some((action) => action.description)
              ? "entity-action-tiles"
              : "entity-panel-actions"
          }
        >
          {panel.actions.map((action) => (
            <EntityActionButton
              key={action.label}
              action={action}
              tile={Boolean(action.description)}
            />
          ))}
        </div>
      )}
      {panel.code?.map((block) => (
        <EntityCode key={block.label} {...block} />
      ))}
      {panel.items && <EntityMiniList items={panel.items} />}
    </section>
  );
}
