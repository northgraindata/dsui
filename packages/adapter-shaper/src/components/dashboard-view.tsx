import type {
  ComponentClient,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShaperDashboard } from "../context.js";
import {
  type Block,
  buildDashboardView,
  type ControlBlock,
  type DashboardView,
  type Primitive,
  type TableBlock,
} from "../dashboard-model.js";
import { formatNumber, formatTime } from "./chart-utils.js";
import { BarChart, GaugeChart, LineChart, PieChart } from "./charts.js";
import {
  buttonStyle,
  cardStyle,
  mutedStyle,
  primaryButtonStyle,
  titleStyle,
} from "./styles.js";

type Variables = Record<string, string | string[]>;

interface DashboardProps {
  id: string;
  title?: string;
}

const EXPORT_FORMATS = ["pdf", "png", "csv", "xlsx"] as const;
const MIN_REFRESH_MS = 5_000;
const TABLE_PAGE = 100;

function formatCell(value: Primitive, type: string): string {
  if (value === null) return "–";
  if (typeof value === "number") {
    if ((type === "date" || type === "timestamp") && Number.isFinite(value))
      return formatTime(value, type === "date");
    return formatNumber(value);
  }
  return String(value);
}

function TableView({ block }: { block: TableBlock }) {
  const [shown, setShown] = useState(TABLE_PAGE);
  const rows = block.rows.slice(0, shown);
  return (
    <div>
      {block.fallbackFor ? (
        <p style={{ ...mutedStyle, margin: "0 0 6px" }}>
          Shown as a table: the {block.fallbackFor} view is not available here.
        </p>
      ) : null}
      <div style={{ overflow: "auto", maxHeight: 420 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th
                  key={column.id}
                  style={{
                    ...headCell,
                    textAlign: column.type === "number" ? "right" : "left",
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              // Result rows have no identity of their own; position is stable
              // for one response.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <tr key={at}>
                {row.map((cell, position) => {
                  const column = block.columns[position];
                  return (
                    <td
                      key={column?.id ?? position}
                      style={{
                        ...bodyCell,
                        textAlign: column?.type === "number" ? "right" : "left",
                      }}
                    >
                      {formatCell(cell, column?.type ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.rows.length > shown ? (
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: 8 }}
          onClick={() => setShown((count) => count + TABLE_PAGE)}
        >
          Show more ({block.rows.length - shown} left)
        </button>
      ) : null}
      {block.rows.length === 0 ? <p style={mutedStyle}>No rows</p> : null}
    </div>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12.5,
  fontVariantNumeric: "tabular-nums",
} as const;
const headCell = {
  position: "sticky",
  top: 0,
  background: "var(--color-surface)",
  padding: "6px 10px",
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
  borderBottom: "1px solid var(--color-border-strong)",
  whiteSpace: "nowrap",
} as const;
const bodyCell = {
  padding: "6px 10px",
  color: "var(--color-secondary)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
} as const;

function BlockBody({ block }: { block: Block }) {
  switch (block.kind) {
    case "table":
      return <TableView block={block} />;
    case "value":
      return (
        <p style={valueStyle}>
          {formatCell(block.value, block.type)}
          <span style={{ ...mutedStyle, display: "block", fontSize: 11 }}>
            {block.label}
          </span>
        </p>
      );
    case "gauge":
      return <GaugeChart block={block} />;
    case "line":
      return <LineChart block={block} />;
    case "bar":
      return <BarChart block={block} />;
    case "pie":
      return <PieChart block={block} />;
    case "control":
      return null;
  }
}

const valueStyle = {
  margin: 0,
  fontSize: 30,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: "var(--color-primary)",
} as const;

/** Gives each visible block a key from its content, numbering repeats. */
function keyedBlocks(blocks: readonly Block[]) {
  const seen = new Map<string, number>();
  return blocks.flatMap((block) => {
    if (block.kind === "control") return [];
    const base = `${block.kind}:${block.title}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return [{ block, key: `${base}:${count}` }];
  });
}

function wide(block: Block): boolean {
  return block.kind === "table" && block.columns.length > 3;
}

function Control({
  block,
  value,
  onChange,
}: {
  block: ControlBlock;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const multiple = block.control === "dropdownMulti";
  const common = {
    id: `shaper-var-${block.variable}`,
    style: inputStyle,
  } as const;
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        fontSize: 11,
        color: "var(--color-muted)",
      }}
    >
      <label htmlFor={common.id}>{block.title}</label>
      {block.control === "input" || block.control === "datepicker" ? (
        <input
          {...common}
          type={block.control === "datepicker" ? "date" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <select
          {...common}
          multiple={multiple}
          value={
            multiple
              ? Array.isArray(value)
                ? value
                : []
              : typeof value === "string"
                ? value
                : (block.options[0] ?? "")
          }
          onChange={(event) =>
            onChange(
              multiple
                ? Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  )
                : event.target.value,
            )
          }
        >
          {block.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const inputStyle = {
  minWidth: 160,
  padding: "6px 8px",
  fontSize: 12.5,
  color: "var(--color-primary)",
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 6,
} as const;

function useDashboard(
  client: ComponentClient,
  id: string,
  variables: Variables,
) {
  const [view, setView] = useState<DashboardView>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const key = JSON.stringify(variables);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    try {
      const result = (await client.executeResource({
        resourceId: "dashboard",
        input: { id, variables: key },
      })) as ShaperDashboard;
      if (mine !== generation.current) return;
      setView(buildDashboardView(result));
      setError(undefined);
    } catch (cause) {
      if (mine === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the dashboard",
        );
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, [client, id, key]);

  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  const reloadAt = view?.reloadAt ?? null;
  useEffect(() => {
    if (reloadAt === null) return;
    const delay = Math.max(MIN_REFRESH_MS, reloadAt - Date.now());
    const timer = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(timer);
  }, [reloadAt, load]);

  return { view, error, loading, reload: load };
}

export default function ShaperDashboardView({
  client,
  node,
}: {
  client: ComponentClient;
  node: PageNode;
}) {
  const props = (
    node.kind === "custom" ? (node.props.props ?? {}) : {}
  ) as DashboardProps;
  const [variables, setVariables] = useState<Variables>({});
  const { view, error, loading, reload } = useDashboard(
    client,
    props.id,
    variables,
  );
  const [notice, setNotice] = useState<string>();
  const [app, setApp] = useState<{ name: string; path: string }>();

  useEffect(() => {
    let active = true;
    client
      .executeResource({ resourceId: "app", input: { id: props.id } })
      .then((result) => {
        if (active) setApp(result as { name: string; path: string });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client, props.id]);

  const controls = useMemo(
    () =>
      (view?.sections ?? []).flatMap((section) =>
        section.blocks.filter(
          (block): block is ControlBlock => block.kind === "control",
        ),
      ),
    [view],
  );

  const exportAs = async (format: (typeof EXPORT_FORMATS)[number]) => {
    setNotice(`Preparing ${format.toUpperCase()}…`);
    const result = await client.executeAction({
      actionId: "export-dashboard",
      input: { id: props.id, format },
    });
    if (result.status === "error") {
      setNotice(result.message ?? "Export failed");
      return;
    }
    const url = (result.data as { url?: string } | undefined)?.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setNotice(undefined);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <button
            type="button"
            style={backStyle}
            onClick={() => client.navigate("/dashboards")}
          >
            ← Dashboards
          </button>
          <h2 style={heading}>{app?.name ?? view?.title ?? "Dashboard"}</h2>
          {app ? (
            <p style={{ ...mutedStyle, margin: "2px 0 0" }}>{app.path}</p>
          ) : null}
        </div>
        <div style={actionsStyle}>
          {notice ? <span style={mutedStyle}>{notice}</span> : null}
          <button
            type="button"
            style={buttonStyle}
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              style={buttonStyle}
              onClick={() => void exportAs(format)}
            >
              {format.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() =>
              client.navigate(
                `/dashboards/${encodeURIComponent(props.id)}/edit`,
              )
            }
          >
            Edit
          </button>
        </div>
      </header>
      <div style={toolbarStyle}>
        {controls.map((control) => (
          <Control
            key={control.variable}
            block={control}
            value={variables[control.variable]}
            onChange={(value) =>
              setVariables((current) => ({
                ...current,
                [control.variable]: value,
              }))
            }
          />
        ))}
      </div>
      {error ? (
        <pre role="alert" style={errorStyle}>
          {error}
        </pre>
      ) : null}
      {!view && !error ? <p style={mutedStyle}>Loading dashboard…</p> : null}
      {view?.sections.map((section, at) => (
        // Sections have no ids; the order is the layout.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <section key={at} style={{ display: "grid", gap: 10 }}>
          {section.title ? (
            <h3 style={sectionHeading}>{section.title}</h3>
          ) : null}
          {section.subtitle ? (
            <p style={{ ...mutedStyle, margin: 0 }}>{section.subtitle}</p>
          ) : null}
          <div style={gridStyle}>
            {keyedBlocks(section.blocks).map(({ block, key }) => (
              <article
                key={key}
                style={{
                  ...cardStyle,
                  alignSelf: "start",
                  gridColumn: wide(block) ? "1 / -1" : undefined,
                }}
              >
                {block.title ? <h4 style={titleStyle}>{block.title}</h4> : null}
                <BlockBody block={block} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const toolbarStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: 10,
} as const;
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
  gap: 12,
} as const;
const errorStyle = {
  margin: 0,
  padding: 12,
  whiteSpace: "pre-wrap",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--color-danger-foreground)",
  background: "color-mix(in srgb, var(--color-unavailable) 14%, transparent)",
  border: "1px solid var(--color-unavailable)",
  borderRadius: 8,
} as const;

const headerStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
} as const;
const actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
} as const;
const heading = {
  margin: "6px 0 0",
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--color-primary)",
} as const;
const sectionHeading = {
  margin: "8px 0 0",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--color-primary)",
} as const;
const backStyle = {
  padding: 0,
  fontSize: 12,
  color: "var(--color-muted)",
  background: "none",
  border: 0,
  cursor: "pointer",
} as const;
