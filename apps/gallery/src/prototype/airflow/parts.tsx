import {
  Button,
  ConfirmDialog,
  notify,
  Tooltip,
} from "@northgraindata/dsui-ui";
import { type ReactNode, useState } from "react";
import {
  stateName,
  TASK_STATES,
} from "../../../../../packages/adapter-airflow/src/states";
import type { State } from "./data";
import { Art, type ArtName, Glyph, type GlyphName } from "./icons";

let navigate = (path: string) => {
  location.hash = path;
};

/** The host decides where the views' own links lead. */
export const setNavigator = (next: (path: string) => void) => {
  navigate = next;
};

export const go = (path: string) => navigate(path);

export const stateLabel = Object.fromEntries(
  TASK_STATES.map((state) => [state, stateName(state)]),
) as Record<State, string>;

export function Dot({ state }: { state: State }) {
  return <i className="ax-dot" data-state={state} aria-hidden="true" />;
}

export function Pill({
  state,
  children,
}: {
  state: State;
  children?: ReactNode;
}) {
  return (
    <span className="ax-pill" data-state={state}>
      <Dot state={state} />
      {children ?? stateLabel[state]}
    </span>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: GlyphName;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip label={label}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
      >
        <Glyph name={icon} />
      </Button>
    </Tooltip>
  );
}

/** A button that confirms first and then reports in a toast. */
export function Act({
  icon,
  label,
  title,
  description,
  variant = "secondary",
  iconOnly = false,
}: {
  icon: GlyphName;
  label: string;
  title: string;
  description: string;
  variant?: "default" | "secondary";
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keeps row clicks out
    // biome-ignore lint/a11y/useKeyWithClickEvents: keeps row clicks out
    <span onClick={(event) => event.stopPropagation()}>
      {iconOnly ? (
        <IconButton icon={icon} label={label} onClick={() => setOpen(true)} />
      ) : (
        <Button variant={variant} onClick={() => setOpen(true)}>
          <Glyph name={icon} />
          {label}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={label}
        onConfirm={() => {
          notify.success(`${label}: done (prototype)`);
        }}
      />
    </span>
  );
}

export function Header({
  art,
  title,
  subtitle,
  meta,
  actions,
  crumbs,
}: {
  art: ArtName;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  crumbs?: [string, string][];
}) {
  return (
    <header className="ax-header">
      {crumbs ? (
        <nav className="ax-crumbs">
          {crumbs.map(([label, path]) => (
            <button type="button" key={path} onClick={() => go(path)}>
              {label}
              <span aria-hidden="true">/</span>
            </button>
          ))}
        </nav>
      ) : null}
      <div className="ax-header-row">
        <Art name={art} size={52} />
        <div className="ax-header-text">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
          {meta ? <div className="ax-meta">{meta}</div> : null}
        </div>
        <div className="ax-header-actions">{actions}</div>
      </div>
    </header>
  );
}

export function Panel({
  title,
  aside,
  children,
  flush = false,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="ax-panel">
      {title ? (
        <div className="ax-panel-head">
          <h2>{title}</h2>
          {aside}
        </div>
      ) : null}
      <div className={flush ? undefined : "ax-panel-body"}>{children}</div>
    </section>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="ax-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={tab === value}
          key={tab}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
