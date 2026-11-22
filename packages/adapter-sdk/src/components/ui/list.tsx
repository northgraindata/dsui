import { useEffect, useMemo, useState } from "react";
import type { ListItem, ListProps } from "../primitives/list";
import type { TableRowAction } from "../primitives/table";
import { type ComponentProps, componentProps } from "../runtime";
import { WorkbenchIcon } from "./icons";
import { ActionMenu, FilterMenu, type Selection } from "./list-menus";
import {
  isRowActionDisabled,
  matchesWhen,
  performRowAction,
  resolveLink,
} from "./row-action";

type Row = Record<string, unknown>;
type Client = ComponentProps["client"];

/** Browser implementation of the SDK list: one readable row per record. */
export function List({ client, node }: ComponentProps) {
  const props = componentProps<ListProps>(node);
  const { rows, error, reload } = useRows(client, props);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Selection>({});
  const [limit, setLimit] = useState(props?.pageSize);

  const visible = useMemo(
    () =>
      props && rows ? matchingRows(rows, props.item, search, selection) : [],
    [rows, props, search, selection],
  );

  if (!props) return null;
  if (error) return <p role="alert">{error}</p>;
  if (!rows) return <p aria-busy="true">Loading…</p>;

  const noun = props.noun ?? "item";
  const shown = limit ? visible.slice(0, limit) : visible;
  const items = shown.map((row, index) => (
    <ListRow
      key={rowKey(row, props.item, index)}
      client={client}
      row={row}
      props={props}
      onDone={reload}
    />
  ));

  return (
    <div className="dsui-list">
      {props.searchable || props.filters?.length ? (
        <Toolbar
          props={props}
          noun={noun}
          total={rows.length}
          matching={visible.length}
          rows={rows}
          search={search}
          onSearch={setSearch}
          selection={selection}
          onSelect={setSelection}
        />
      ) : null}
      {items.length ? (
        <ul className="dsui-list-items">{items}</ul>
      ) : (
        <p className="dsui-list-empty">
          {rows.length
            ? `No ${noun}s match.`
            : (props.emptyMessage ?? "Nothing here yet.")}
        </p>
      )}
      {shown.length < visible.length ? (
        <button
          type="button"
          className="dsui-list-more"
          onClick={() =>
            setLimit((current) => (current ?? 0) + (props.pageSize ?? 25))
          }
        >
          Show more · {visible.length - shown.length} left
        </button>
      ) : null}
    </div>
  );
}

export default List;

function Toolbar({
  props,
  noun,
  total,
  matching,
  rows,
  search,
  onSearch,
  selection,
  onSelect,
}: {
  props: ListProps;
  noun: string;
  total: number;
  matching: number;
  rows: readonly Row[];
  search: string;
  onSearch: (value: string) => void;
  selection: Selection;
  onSelect: (next: Selection) => void;
}) {
  return (
    <div className="dsui-list-toolbar">
      <span className="dsui-list-count">
        {matching === total
          ? plural(total, noun)
          : `${matching} of ${plural(total, noun)}`}
      </span>
      {props.searchable ? (
        <label className="dsui-list-search">
          <WorkbenchIcon name="search" size={14} />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={`Find ${articleFor(noun)} ${noun}…`}
            aria-label={`Find ${noun}`}
          />
        </label>
      ) : null}
      {props.filters?.length ? (
        <FilterMenu
          filters={props.filters}
          rows={rows}
          selection={selection}
          onChange={onSelect}
        />
      ) : null}
    </div>
  );
}

function useRows(client: Client, props: ListProps | undefined) {
  const [data, setData] = useState<unknown>(props?.data);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const source = props?.source;

  useEffect(() => {
    void refresh;
    if (!source) return;
    if (source.refresh?.kind === "poll" && client.watchResource)
      return client.watchResource(source, (result) => setData(result));
    let active = true;
    setError(undefined);
    client
      .executeResource(source)
      .then((result) => active && setData(result))
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load records",
          );
      });
    return () => {
      active = false;
    };
  }, [client, source, refresh]);

  const rows = useMemo(
    () =>
      Array.isArray(data)
        ? data.filter(
            (row): row is Row =>
              !!row && typeof row === "object" && !Array.isArray(row),
          )
        : undefined,
    [data],
  );
  return { rows, error, reload: () => setRefresh((value) => value + 1) };
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function articleFor(noun: string) {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

function rowKey(row: Row, item: ListItem, index: number) {
  return `${text(row[item.title])}:${index}`;
}

function matchingRows(
  rows: readonly Row[],
  item: ListItem,
  search: string,
  selection: Selection,
): Row[] {
  const query = search.trim().toLowerCase();
  const fields = [
    item.title,
    item.description,
    item.badge,
    ...(item.meta ?? []),
  ].filter((field): field is string => !!field);
  return rows.filter(
    (row) =>
      (!query ||
        fields.some((field) =>
          text(row[field]).toLowerCase().includes(query),
        )) &&
      Object.entries(selection).every(
        ([field, values]) =>
          values.length === 0 || values.includes(text(row[field])),
      ),
  );
}

function ListRow({
  client,
  row,
  props,
  onDone,
}: {
  client: Client;
  row: Row;
  props: ListProps;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { item } = props;
  const href = props.rowLink
    ? resolveLink(props.rowLink.path, props.rowLink.params, row)
    : null;
  const run = (spec: TableRowAction) => {
    if (
      spec.confirmation &&
      !window.confirm(
        `${spec.confirmation.title}\n\n${spec.confirmation.description}`,
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    void performRowAction(client, spec, row, onDone)
      .then(setError)
      .finally(() => setBusy(false));
  };

  return (
    <li className="dsui-list-row" data-busy={busy}>
      {href ? (
        <button
          type="button"
          className="dsui-list-main"
          onClick={() => client.navigate(href)}
        >
          <ItemText row={row} item={item} error={error} />
        </button>
      ) : (
        <div className="dsui-list-main">
          <ItemText row={row} item={item} error={error} />
        </div>
      )}
      {item.status ? <Status row={row} status={item.status} /> : null}
      <RowActions
        title={text(row[item.title])}
        row={row}
        actions={props.rowActions ?? []}
        busy={busy}
        onRun={run}
      />
    </li>
  );
}

function ItemText({
  row,
  item,
  error,
}: {
  row: Row;
  item: ListItem;
  error: string | undefined;
}) {
  const badge = item.badge ? text(row[item.badge]) : "";
  const secondary = [item.description, ...(item.meta ?? [])]
    .map((field) => (field ? text(row[field]) : ""))
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      {item.icon ? (
        <span className="dsui-list-icon" aria-hidden="true">
          <WorkbenchIcon name={item.icon} size={18} />
        </span>
      ) : null}
      <span className="dsui-list-text">
        <span className="dsui-list-title">
          <strong>{text(row[item.title]) || "—"}</strong>
          {badge ? <span className="dsui-list-badge">{badge}</span> : null}
        </span>
        {secondary ? (
          <span className="dsui-list-description">{secondary}</span>
        ) : null}
        {error ? (
          <span className="dsui-list-error" role="alert">
            {error}
          </span>
        ) : null}
      </span>
    </>
  );
}

/**
 * Primary actions with an icon sit on the row; the rest share a menu. An
 * action that does not apply to this row leaves an empty slot, so statuses
 * and buttons stay aligned down the list.
 */
function RowActions({
  title,
  row,
  actions,
  busy,
  onRun,
}: {
  title: string;
  row: Row;
  actions: readonly TableRowAction[];
  busy: boolean;
  onRun: (spec: TableRowAction) => void;
}) {
  const inline = actions.filter(
    (spec) => spec.variant === "primary" && spec.icon,
  );
  const menu = actions.filter((spec) => !inline.includes(spec));
  const applicable = menu.filter((spec) => matchesWhen(row, spec.when));
  if (!inline.length && !menu.length) return null;
  return (
    <span className="dsui-list-actions">
      {inline.map((spec) =>
        matchesWhen(row, spec.when) ? (
          <button
            key={spec.label}
            type="button"
            className="dsui-list-action"
            title={spec.label}
            aria-label={`${spec.label} ${title}`}
            disabled={
              busy ||
              isRowActionDisabled(row, spec.disabledWhen) ||
              (!spec.action && !spec.link)
            }
            onClick={() => onRun(spec)}
          >
            <WorkbenchIcon name={spec.icon ?? "play"} size={16} />
          </button>
        ) : (
          <span key={spec.label} className="dsui-list-action-slot" />
        ),
      )}
      {menu.length ? (
        <MenuSlot
          title={title}
          row={row}
          actions={applicable}
          busy={busy}
          onRun={onRun}
        />
      ) : null}
    </span>
  );
}

const STATUS_TONES: [RegExp, string][] = [
  [
    /^(success|succeeded|pass(ed)?|healthy|active|fresh|ok|complete(d)?|materialized)$/,
    "healthy",
  ],
  [
    /^(error|errored|fail(ed|ure)?|unavailable|cancel(l)?ed|runtime error)$/,
    "unavailable",
  ],
  [/^(warn(ing)?|paused|stale|up for retry|retrying|degraded)$/, "warning"],
  [/^(running|started|starting|in progress|queued|pending|scheduled)$/, "info"],
];

/** Tone for a status label when the row does not provide one. */
function toneForStatus(label: string): string {
  const value = label.trim().toLowerCase().replaceAll("_", " ");
  return STATUS_TONES.find(([pattern]) => pattern.test(value))?.[1] ?? "muted";
}

function Status({
  row,
  status,
}: {
  row: Row;
  status: NonNullable<ListItem["status"]>;
}) {
  const label = text(row[status.label]);
  if (!label) return <span className="dsui-list-status" />;
  const tone = (status.tone && text(row[status.tone])) || toneForStatus(label);
  const detail = status.detail ? text(row[status.detail]) : "";
  return (
    <span className="dsui-list-status" data-tone={tone}>
      <span className="dsui-list-status-label">
        <i aria-hidden="true" />
        {label}
      </span>
      {detail && detail !== "—" ? <small>{detail}</small> : null}
    </span>
  );
}

/** The overflow menu, or an empty slot when none of its actions apply. */
function MenuSlot({
  title,
  row,
  actions,
  busy,
  onRun,
}: {
  title: string;
  row: Row;
  actions: readonly TableRowAction[];
  busy: boolean;
  onRun: (spec: TableRowAction) => void;
}) {
  if (!actions.length) return <span className="dsui-list-action-slot" />;
  return (
    <ActionMenu
      title={title}
      row={row}
      actions={actions}
      disabled={busy}
      onRun={onRun}
    />
  );
}
