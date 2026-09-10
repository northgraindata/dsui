import type {
  ActionReference,
  MeterData,
  MeterSegment,
  OverviewCard,
  PageNode,
} from "@northgraindata/dsui-core";
import { Button, Surface } from "@northgraindata/dsui-ui";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import type { RendererClient } from "../types/renderer-types";
import { WorkbenchIcon } from "./icons";
import { resolveLink } from "./table";

type RenderNode = (client: RendererClient, node: PageNode) => ReactNode;

function statText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const BADGE_TONES = new Set(["healthy", "warning", "unavailable", "info"]);

function asCard(row: Record<string, unknown>): OverviewCard | null {
  if (typeof row.title !== "string" || !row.title) return null;
  const badgeTone =
    typeof row.badgeTone === "string" && BADGE_TONES.has(row.badgeTone)
      ? (row.badgeTone as OverviewCard["badgeTone"])
      : undefined;
  const meta = Array.isArray(row.meta)
    ? row.meta.map((entry) => String(entry))
    : undefined;
  const link = asRecord(row.link);
  const linkProps =
    link && typeof link.path === "string"
      ? {
          path: link.path,
          params:
            asRecord(link.params) !== null
              ? Object.fromEntries(
                  Object.entries(link.params as Record<string, unknown>).map(
                    ([key, field]) => [key, String(field)],
                  ),
                )
              : {},
        }
      : undefined;
  return {
    title: row.title,
    ...(typeof row.description === "string"
      ? { description: row.description }
      : {}),
    ...(typeof row.badge === "string" ? { badge: row.badge } : {}),
    ...(badgeTone ? { badgeTone } : {}),
    ...(typeof row.icon === "string" ? { icon: row.icon } : {}),
    ...(meta ? { meta } : {}),
    ...(linkProps ? { link: linkProps } : {}),
  };
}

function useResourceRecord(
  client: RendererClient,
  source: { resourceId: string; input?: unknown } | undefined,
  initial: Record<string, unknown> | undefined,
  label: string,
): { data?: Record<string, unknown>; error?: string } {
  const [data, setData] = useState<Record<string, unknown> | undefined>(
    initial,
  );
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!source) return;
    let active = true;
    client
      .executeResource(source)
      .then((result) => {
        const record = asRecord(result);
        if (active) {
          if (record) setData(record);
          else setError(`Could not load ${label}`);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : `Could not load ${label}`,
          );
      });
    return () => {
      active = false;
    };
  }, [client, source, label]);
  return { data, error };
}

function useResourceRows(
  client: RendererClient,
  source: { resourceId: string; input?: unknown } | undefined,
  initial: readonly OverviewCard[] | undefined,
  label: string,
): {
  rows?: { card: OverviewCard; context: Record<string, unknown> }[];
  error?: string;
} {
  const [rows, setRows] = useState<
    { card: OverviewCard; context: Record<string, unknown> }[] | undefined
  >(() =>
    initial
      ? initial.map((card) => ({
          card,
          context: card as unknown as Record<string, unknown>,
        }))
      : undefined,
  );
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!source) return;
    let active = true;
    client
      .executeResource(source)
      .then((result) => {
        if (!active) return;
        if (!Array.isArray(result)) {
          setError(`Could not load ${label}`);
          return;
        }
        setRows(
          result
            .map((row) => {
              const record = asRecord(row);
              if (!record) return null;
              const card = asCard(record);
              return card ? { card, context: record } : null;
            })
            .filter(
              (
                entry,
              ): entry is {
                card: OverviewCard;
                context: Record<string, unknown>;
              } => entry !== null,
            ),
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : `Could not load ${label}`,
          );
      });
    return () => {
      active = false;
    };
  }, [client, source, label]);
  return { rows, error };
}

function ActionButton({
  client,
  action,
  children,
  variant,
}: {
  client: RendererClient;
  action: ActionReference;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant={variant === "primary" ? "default" : (variant ?? "secondary")}
        disabled={busy}
        title={error}
        onClick={() => {
          setBusy(true);
          setError(undefined);
          client
            .executeAction(action)
            .then((result) => {
              if (result.status !== "success")
                setError(result.message ?? "Action failed");
            })
            .catch((cause) =>
              setError(
                cause instanceof Error ? cause.message : "Action failed",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {children}
      </Button>
      {error ? (
        <span className="text-[10px] text-unavailable">{error}</span>
      ) : null}
    </span>
  );
}

export function StatGridView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "stat-grid" }>;
}) {
  const { data, error } = useResourceRecord(
    client,
    node.props.source,
    node.props.data,
    "statistics",
  );
  if (error)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!data)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading statistics…
      </Surface>
    );
  return (
    <div className="ov-stats">
      {node.props.items.map((item) => (
        <div className="ov-stat" key={item.field}>
          {item.icon ? (
            <span className="ov-stat-icon">
              <WorkbenchIcon name={item.icon} size={20} />
            </span>
          ) : null}
          <strong className="ov-stat-value">
            {statText(data[item.field])}
          </strong>
          <small className="ov-stat-label">{item.label}</small>
        </div>
      ))}
    </div>
  );
}

export function SectionView({
  client,
  node,
  renderNode,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "section" }>;
  renderNode: RenderNode;
}) {
  const content = Array.isArray(node.props.content)
    ? node.props.content
    : [node.props.content];
  const link = node.props.link;
  return (
    <section className="ov-section">
      <header className="ov-section-header">
        <div>
          <h2>{node.props.title}</h2>
          {node.props.description ? <p>{node.props.description}</p> : null}
        </div>
        {link ? (
          <button
            type="button"
            className="ov-section-link"
            onClick={() => client.navigate(link.path)}
          >
            {link.label}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </header>
      {content.map((child) => renderNode(client, child))}
    </section>
  );
}

export function CardListView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "card-list" }>;
}) {
  const { rows, error } = useResourceRows(
    client,
    node.props.source,
    node.props.cards,
    "items",
  );
  if (error)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!rows)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading items…
      </Surface>
    );
  if (!rows.length)
    return (
      <Surface className="p-5 text-[12px] text-secondary">No items.</Surface>
    );
  return (
    <div
      className="ov-cards"
      {...(node.props.columns ? { "data-cols": node.props.columns } : {})}
    >
      {rows.map(({ card, context }) => {
        const href = card.link
          ? resolveLink(card.link.path, card.link.params, context)
          : null;
        return (
          <article className="ov-card" key={card.title}>
            <div className="ov-card-heading">
              {card.icon ? (
                <span className="ov-card-icon">
                  <WorkbenchIcon name={card.icon} size={20} />
                </span>
              ) : null}
              <div className="ov-card-body">
                {href ? (
                  <button
                    type="button"
                    className="ov-card-title"
                    onClick={() => client.navigate(href)}
                  >
                    {card.title}
                  </button>
                ) : (
                  <h3>{card.title}</h3>
                )}{" "}
                {card.description ? <p>{card.description}</p> : null}
              </div>
              {card.badge ? (
                <span className="ov-badge" data-tone={card.badgeTone ?? "info"}>
                  {card.badge}
                </span>
              ) : null}
            </div>
            {card.meta?.length ? (
              <ul className="ov-card-meta">
                {card.meta.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            ) : null}
            {href ? (
              <span className="ov-card-chevron" aria-hidden="true">
                <WorkbenchIcon name="chevron" size={14} />
              </span>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function ActionListView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "action-list" }>;
}) {
  return (
    <div className="ov-actions">
      {node.props.items.map((item) => {
        const body = (
          <>
            {item.icon ? (
              <span className="ov-action-icon">
                <WorkbenchIcon name={item.icon} size={20} />
              </span>
            ) : null}
            <span className="ov-action-text">
              <strong>{item.title}</strong>
              {item.description ? (
                <small className="ov-action-desc">{item.description}</small>
              ) : null}
            </span>
            {item.kbd ? (
              <kbd className="ov-kbd">{item.kbd}</kbd>
            ) : (
              <span className="ov-action-chevron" aria-hidden="true">
                →
              </span>
            )}
          </>
        );
        const key = `${item.title}:${item.link ?? item.action?.actionId ?? "static"}`;
        const link = item.link;
        if (link)
          return (
            <button
              type="button"
              className="ov-action"
              key={key}
              onClick={() => client.navigate(link)}
            >
              {body}
            </button>
          );
        if (item.action)
          return (
            <ActionButton key={key} client={client} action={item.action}>
              <span className="ov-action">{body}</span>
            </ActionButton>
          );
        return (
          <div className="ov-action" key={key}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function ColumnsView({
  client,
  node,
  renderNode,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "columns" }>;
  renderNode: RenderNode;
}) {
  return (
    <div
      className="ov-columns"
      style={
        {
          "--ov-cols": node.props.columns
            .map((column) => `${column.weight ?? 1}fr`)
            .join(" "),
        } as CSSProperties
      }
    >
      {node.props.columns.map((column, index) => {
        const content = Array.isArray(column.content)
          ? column.content
          : [column.content];
        return (
          // Column order is adapter-declared and stable for the page lifetime.
          // biome-ignore lint/suspicious/noArrayIndexKey: static adapter-declared column order
          <div className="ov-column" key={`column-${index}`}>
            {content.map((child) => renderNode(client, child))}
          </div>
        );
      })}
    </div>
  );
}

const METER_TONES = new Set([
  "info",
  "healthy",
  "warning",
  "unavailable",
  "muted",
  "deep",
]);

function asMeter(value: unknown): MeterData | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.segments)) return null;
  const segments: MeterSegment[] = [];
  for (const entry of record.segments) {
    const segment = asRecord(entry);
    if (
      !segment ||
      typeof segment.label !== "string" ||
      typeof segment.value !== "number" ||
      !Number.isFinite(segment.value) ||
      segment.value < 0
    )
      return null;
    segments.push({
      label: segment.label,
      value: segment.value,
      tone:
        typeof segment.tone === "string" && METER_TONES.has(segment.tone)
          ? (segment.tone as MeterSegment["tone"])
          : "info",
    });
  }
  return {
    segments,
    ...(typeof record.footer === "string" ? { footer: record.footer } : {}),
  };
}

export function MeterView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "meter" }>;
}) {
  const [data, setData] = useState<MeterData | undefined>(() =>
    node.props.data ? (asMeter(node.props.data) ?? undefined) : undefined,
  );
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!node.props.source) return;
    let active = true;
    client
      .executeResource(node.props.source)
      .then((result) => {
        if (!active) return;
        const meter = asMeter(result);
        if (meter) setData(meter);
        else setError("Could not load storage");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load storage",
          );
      });
    return () => {
      active = false;
    };
  }, [client, node.props.source]);
  if (error)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!data)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading storage…
      </Surface>
    );
  const total = data.segments.reduce((sum, segment) => sum + segment.value, 0);
  const legend = data.segments.filter((segment) => segment.legend !== false);
  const legendTotal = legend.reduce((sum, segment) => sum + segment.value, 0);
  const header =
    total === legendTotal
      ? formatBytes(total)
      : `${formatBytes(legendTotal)} / ${formatBytes(total)}`;
  return (
    <div className="ov-meter">
      <div className="ov-meter-head">
        <span>{header}</span>
      </div>
      <div className="ov-meter-bar" aria-hidden="true">
        {data.segments.map((segment) => (
          <span
            key={segment.label}
            className="ov-meter-seg"
            data-tone={segment.tone ?? "info"}
            style={{
              width: `${total > 0 ? (segment.value / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <ul className="ov-meter-legend">
        {legend.map((segment) => (
          <li key={segment.label}>
            <span
              className="ov-meter-dot"
              data-tone={segment.tone ?? "info"}
              aria-hidden="true"
            />
            <span className="ov-meter-label">{segment.label}</span>
            <span className="ov-meter-value">{formatBytes(segment.value)}</span>
            <span className="ov-meter-pct">
              {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
      {data.footer ? <p className="ov-meter-foot">{data.footer}</p> : null}
    </div>
  );
}
