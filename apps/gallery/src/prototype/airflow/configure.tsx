import {
  Button,
  Input,
  Menu,
  Modal,
  notify,
  Select,
  Tooltip,
} from "@northgraindata/dsui-ui";
import { Fragment, type ReactNode, useState } from "react";
import {
  ConnectionMark,
  connectionTypeName,
  connectionTypeOptions,
} from "./connection-mark";
import {
  type Connection,
  connections,
  pools,
  type Variable,
  variables,
} from "./data";
import { Glyph } from "./icons";
import {
  Choice,
  Empty,
  Search,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "./list";
import { Act, Header, IconButton, Panel } from "./parts";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="ax-field">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </div>
  );
}

const connectionTypes = unique(connections.map((item) => item.type));

/** The fields Airflow itself stores for a connection. */
function ConnectionModal({
  editing,
  onClose,
}: {
  editing?: Connection;
  onClose: () => void;
}) {
  const [type, setType] = useState(editing?.type ?? "postgres");
  const [id, setId] = useState(editing?.id ?? "");
  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={editing ? `Edit ${editing.id}` : "New connection"}
      description="DAGs read it by its ID."
    >
      <div className="ax-modal">
        <div className="ax-form">
          <div className="ax-pair">
            <Field label="Connection ID">
              <Input
                aria-label="Connection ID"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="billing_db"
              />
            </Field>
            <Field label="Type" hint="from installed providers">
              <Select
                ariaLabel="Type"
                value={type}
                onValueChange={setType}
                options={connectionTypeOptions(connectionTypes)}
              />
            </Field>
          </div>
          <h3>Server</h3>
          <div className="ax-pair ax-pair-port">
            <Field label="Host">
              <Input
                aria-label="Host"
                defaultValue={editing?.host}
                placeholder="db.internal"
              />
            </Field>
            <Field label="Port">
              <Input aria-label="Port" defaultValue={editing?.port} />
            </Field>
          </div>
          <Field label="Schema">
            <Input aria-label="Schema" defaultValue={editing?.schema} />
          </Field>
          <h3>Credentials</h3>
          <div className="ax-pair">
            <Field label="Login">
              <Input aria-label="Login" defaultValue={editing?.login} />
            </Field>
            <Field
              label="Password"
              hint={editing ? "empty keeps it" : undefined}
            >
              <Input aria-label="Password" type="password" />
            </Field>
          </div>
          <details>
            <summary>Description and extra</summary>
            <div className="ax-form">
              <Field label="Description">
                <Input
                  aria-label="Description"
                  defaultValue={editing?.description}
                />
              </Field>
              <Field label="Extra" hint="JSON">
                <textarea aria-label="Extra" rows={4} defaultValue="{}" />
              </Field>
            </div>
          </details>
        </div>
        <footer>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!id}
            onClick={() => {
              notify.success(`Connection ${id} saved (prototype)`);
              onClose();
            }}
          >
            <Glyph name="check" />
            {editing ? "Save" : "Create"}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

export function Connections() {
  const [open, setOpen] = useState<{ editing?: Connection }>();
  const [filters, setFilters] = useRemembered("connections:filters", {
    search: "",
    type: "",
  });
  const needle = filters.search.trim().toLowerCase();
  const rows = connections.filter(
    (item) =>
      (!needle ||
        `${item.id} ${item.host} ${item.description}`
          .toLowerCase()
          .includes(needle)) &&
      (!filters.type || item.type === filters.type),
  );
  const { visible, pager } = usePages(
    "connections",
    rows,
    JSON.stringify(filters),
  );
  return (
    <>
      <Header
        art="connections"
        title="Connections"
        actions={
          <Button onClick={() => setOpen({})}>
            <Glyph name="plus" />
            New connection
          </Button>
        }
      />
      <Toolbar>
        <Search
          label="Search ID, host or description"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
        <Choice
          all="All types"
          value={filters.type}
          options={[]}
          rich={{
            options: connectionTypeOptions(connectionTypes),
            allIcon: <ConnectionMark type="" />,
          }}
          onChange={(type) => setFilters({ ...filters, type })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table ax-conn-table" data-dsui-scroll>
          <div className="ax-thead">
            <span>Connection</span>
            <span>Type</span>
            <span>Target</span>
            <span>Login</span>
            <span />
          </div>
          {visible.map((item) => (
            <div className="ax-tr ax-tr-static" key={item.id}>
              <span className="ax-name ax-with-glyph">
                <ConnectionMark type={item.type} />
                <span>
                  <strong>{item.id}</strong>
                  <small>{item.description}</small>
                </span>
              </span>
              <span>{connectionTypeName(item.type)}</span>
              <code>
                {item.host
                  ? `${item.host}${item.port ? `:${item.port}` : ""}${item.schema ? ` / ${item.schema}` : ""}`
                  : "—"}
              </code>
              <span>{item.login || "—"}</span>
              <Menu
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`More actions for ${item.id}`}
                  >
                    <Glyph name="more" />
                  </Button>
                }
                items={[
                  {
                    label: "Edit",
                    icon: <Glyph name="edit" />,
                    onSelect: () => setOpen({ editing: item }),
                  },
                  {
                    label: "Delete",
                    icon: <Glyph name="trash" />,
                    tone: "danger",
                    onSelect: () => notify.success("Delete (prototype)"),
                  },
                ]}
              />
            </div>
          ))}
        </div>
        {rows.length ? null : (
          <Empty
            filtered
            onClear={() => setFilters({ search: "", type: "" })}
          />
        )}
        {pager}
      </Panel>
      {open ? (
        <ConnectionModal
          editing={open.editing}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}

type Kind = "json" | "number" | "boolean" | "secret" | "text";
const kindOf = (value: string): Kind =>
  value === "***"
    ? "secret"
    : /^[[{]/.test(value)
      ? "json"
      : /^-?\d+(\.\d+)?$/.test(value)
        ? "number"
        : /^(true|false)$/i.test(value)
          ? "boolean"
          : "text";
const kindMark: Record<Kind, string> = {
  json: "{ }",
  number: "123",
  boolean: "T/F",
  secret: "•••",
  text: "Abc",
};
const kindName: Record<Kind, string> = {
  json: "JSON",
  number: "Number",
  boolean: "Boolean",
  secret: "Masked by Airflow",
  text: "Text",
};

const pretty = (value: string) => {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

function VariableRow({
  variable,
  expanded,
  onToggle,
}: {
  variable: Variable;
  expanded: boolean;
  onToggle: () => void;
}) {
  const kind = kindOf(variable.value);
  return (
    <Fragment>
      <div className="ax-tr ax-tr-static" data-open={expanded}>
        <Tooltip label={kindName[kind]}>
          <span
            className="ax-kind"
            data-kind={kind}
            role="img"
            aria-label={kindName[kind]}
          >
            {kindMark[kind]}
          </span>
        </Tooltip>
        <button
          type="button"
          className="ax-name"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <strong>{variable.key}</strong>
          <small>{variable.description || "No description"}</small>
        </button>
        <button
          type="button"
          className="ax-value"
          data-kind={kind}
          onClick={onToggle}
        >
          {variable.value}
        </button>
        <span className="ax-row-actions">
          {kind === "secret" ? null : (
            <IconButton
              icon="copy"
              label="Copy value"
              onClick={() => {
                void navigator.clipboard?.writeText(variable.value);
                notify.success(`Copied ${variable.key}`);
              }}
            />
          )}
          <IconButton icon="edit" label={`Edit ${variable.key}`} />
          <Act
            iconOnly
            icon="trash"
            label="Delete"
            title={`Delete variable ${variable.key}?`}
            description="DAGs that read it will fail."
          />
        </span>
      </div>
      {expanded ? (
        <pre className="ax-log ax-expanded">
          {kind === "secret"
            ? "Airflow hides this value, because its key looks sensitive."
            : pretty(variable.value)}
        </pre>
      ) : null}
    </Fragment>
  );
}

export function Variables() {
  const [search, setSearch] = useRemembered("variables:search", "");
  const [expanded, setExpanded] = useState("");
  const needle = search.trim().toLowerCase();
  const rows = variables.filter(
    (item) =>
      !needle ||
      `${item.key} ${item.description}`.toLowerCase().includes(needle),
  );
  const { visible, pager } = usePages("variables", rows, search);
  return (
    <>
      <Header
        art="variables"
        title="Variables"
        actions={
          <Button>
            <Glyph name="plus" />
            New variable
          </Button>
        }
      />
      <Toolbar>
        <Search
          label="Search key or description"
          value={search}
          onChange={setSearch}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table ax-var-table" data-dsui-scroll>
          <div className="ax-thead">
            <span />
            <span>Key</span>
            <span>Value</span>
            <span />
          </div>
          {visible.map((variable) => (
            <VariableRow
              key={variable.key}
              variable={variable}
              expanded={expanded === variable.key}
              onToggle={() =>
                setExpanded(expanded === variable.key ? "" : variable.key)
              }
            />
          ))}
        </div>
        {rows.length ? null : <Empty filtered onClear={() => setSearch("")} />}
        {pager}
      </Panel>
    </>
  );
}

export function Pools() {
  return (
    <>
      <Header art="pools" title="Pools" />
      <div className="ax-cards">
        {pools.map((pool) => {
          const shown = Math.min(pool.slots, 64);
          const used = Math.round((pool.running / pool.slots) * shown);
          return (
            <article key={pool.name} className="ax-card ax-pool">
              <div>
                <strong>{pool.name}</strong>
                <small>{pool.description}</small>
              </div>
              <IconButton icon="edit" label={`Edit ${pool.name}`} />
              <div className="ax-slots">
                {Array.from({ length: shown }, (_, index) => (
                  <i
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                    key={`slot-${index}`}
                    data-used={index < used}
                    data-full={pool.running >= pool.slots}
                  />
                ))}
              </div>
              <footer>
                <span>
                  <b>{pool.running}</b> of {pool.slots} running
                </span>
                {pool.queued ? (
                  <span className="ax-warn">{pool.queued} waiting</span>
                ) : (
                  <span className="ax-muted">no queue</span>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
