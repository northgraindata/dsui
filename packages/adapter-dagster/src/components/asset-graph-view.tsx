import type {
  ComponentClient,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { resolveLink } from "@northgraindata/dsui-adapter-sdk/components/ui/table";
import {
  type CSSProperties,
  memo,
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AssetGraphProps } from "./asset-graph";
import {
  clampOffset,
  clampZoom,
  fitZoom,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  type GraphFrame,
  type GraphInputNode,
  type GraphLaidOutNode,
  type GraphLayout,
  type GraphOffset,
  type GraphSize,
  layoutGraph,
  restingOffset,
  zoomAround,
} from "./graph-layout";
import { GRAPH_STYLES } from "./graph-styles";
import { type KindStyle, kindKey, kindStyle } from "./kinds";

/**
 * Dagster's lineage graph: assets (or ops and run steps) laid out by
 * dependency, framed by group, and badged with their kinds. Owned by this
 * adapter because a fetched adapter can only bundle files in its package.
 */

/** Workspace bottom padding plus the panel border. */
const CANVAS_BOTTOM_GUTTER = 30;
const MIN_CANVAS_HEIGHT = 420;
const PAN_THRESHOLD = 4;
const REVEAL_MARGIN = 28;
const PANEL_WIDTH = 340;
const BUTTON_ZOOM_FACTOR = 1.25;
/** Wheel sensitivity: pinch gestures report much smaller deltas. */
const WHEEL_ZOOM_SPEED = 0.0018;
const PINCH_ZOOM_SPEED = 0.012;
const MAX_TAGS = 3;

interface AssetGraphNode {
  readonly kind: "custom";
  readonly props: {
    component: "dagster/asset-graph";
    props?: Omit<AssetGraphProps, "nodeAction"> & {
      nodeAction?: Omit<
        NonNullable<AssetGraphProps["nodeAction"]>,
        "action"
      > & {
        action: { actionId: string };
      };
    };
  };
}

type GraphProps = NonNullable<AssetGraphNode["props"]["props"]>;
type CheckState = "passing" | "warning" | "failing" | "pending";

interface GraphRow extends GraphInputNode {
  label: string;
  kinds: string[];
  state?: string;
  stateLabel?: string;
  caption?: string;
  description?: string;
  external: boolean;
  checkState?: CheckState;
  checkLabel?: string;
  details: [string, string][];
  raw: Record<string, unknown>;
}

type LaidOut = GraphLaidOutNode<GraphRow>;
type Emphasis = "active" | "lineage" | "match" | "idle" | "dimmed";
interface View {
  zoom: number;
  x: number;
  y: number;
  /** Animate the transform; off while dragging or wheel-zooming. */
  smooth: boolean;
}

function text(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => item !== null && item !== undefined).map(String)
    : [];
}

function isCheckState(value: unknown): value is CheckState {
  return (
    value === "passing" ||
    value === "warning" ||
    value === "failing" ||
    value === "pending"
  );
}

/** Reads one graph node from a resource row; null when it has no id. */
function graphRow(row: Record<string, unknown>): GraphRow | null {
  const id = text(row.id);
  if (!id) return null;
  const details =
    row.details &&
    typeof row.details === "object" &&
    !Array.isArray(row.details)
      ? Object.entries(row.details as Record<string, unknown>).flatMap(
          ([key, value]): [string, string][] => {
            const shown = text(value);
            return shown ? [[key, shown]] : [];
          },
        )
      : [];
  return {
    id,
    label: text(row.label) ?? id,
    dependsOn: strings(row.dependsOn),
    group: text(row.group),
    kinds: strings(row.kinds),
    state: text(row.state)?.toLowerCase(),
    stateLabel: text(row.stateLabel),
    caption: text(row.caption),
    description: text(row.description),
    external: row.external === true,
    checkState: isCheckState(row.checkState) ? row.checkState : undefined,
    checkLabel: text(row.checkLabel),
    details,
    raw: row,
  };
}

interface StateStyle {
  label: string;
  color: string;
  running: boolean;
}

function state(label: string, color: string, running = false): StateStyle {
  return { label, color: `var(--color-${color})`, running };
}

const STATE_STYLES: Record<string, StateStyle> = {
  materialized: state("Materialized", "healthy"),
  success: state("Succeeded", "healthy"),
  failed: state("Failed", "unavailable"),
  materializing: state("Running", "accent", true),
  running: state("Running", "accent", true),
  stale: state("Stale", "warning"),
  queued: state("Waiting", "warning"),
  source: state("Source", "secondary"),
};
const UNKNOWN_STATE = state("Not run", "muted");

function stateStyle(key: string | undefined): StateStyle {
  return (key && STATE_STYLES[key]) || UNKNOWN_STATE;
}

const CHECK_STYLES: Record<CheckState, { color: string; glyph: string }> = {
  passing: { color: "var(--color-healthy)", glyph: "✓" },
  warning: { color: "var(--color-warning)", glyph: "!" },
  failing: { color: "var(--color-unavailable)", glyph: "!" },
  pending: { color: "var(--color-muted)", glyph: "○" },
};

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function tint(color: string | undefined, amount: number) {
  return color
    ? `color-mix(in srgb, ${color} ${amount}%, transparent)`
    : undefined;
}

/** Fills the viewport below the canvas and tracks its size. */
function useCanvasSize(element: HTMLElement | null) {
  const [size, setSize] = useState<GraphSize>();
  useEffect(() => {
    if (!element) return;
    const measure = () => {
      const height = Math.max(
        MIN_CANVAS_HEIGHT,
        window.innerHeight -
          element.getBoundingClientRect().top -
          CANVAS_BOTTOM_GUTTER,
      );
      const width = element.clientWidth;
      setSize((current) =>
        current && current.height === height && current.width === width
          ? current
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [element]);
  return size;
}

/** Walks edges transitively in one direction from a node. */
function reach(start: string, next: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(next.get(start) ?? [])];
  while (queue.length) {
    const id = queue.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    queue.push(...(next.get(id) ?? []));
  }
  return seen;
}

function Dot({ color }: { color: string }) {
  return (
    <i
      aria-hidden="true"
      className="dg-dot"
      style={{ backgroundColor: color }}
    />
  );
}

/** Dagster's icon for a kind; single-colour ones take the text colour. */
function KindIcon({ style, size }: { style: KindStyle; size: number }) {
  if (!style.icon) return null;
  if (style.mono)
    return (
      <i
        aria-hidden="true"
        className="dg-kind-icon dg-kind-icon--mono"
        style={{
          width: size,
          height: size,
          WebkitMaskImage: `url("${style.icon}")`,
          maskImage: `url("${style.icon}")`,
        }}
      />
    );
  return (
    <img
      aria-hidden="true"
      alt=""
      className="dg-kind-icon"
      src={style.icon}
      width={size}
      height={size}
    />
  );
}

function KindGlyph({ kind, label }: { kind?: string; label: string }) {
  const style = kind ? kindStyle(kind) : undefined;
  if (style?.icon)
    return (
      <span aria-hidden="true" className="dg-glyph" data-icon="true">
        <KindIcon style={style} size={20} />
      </span>
    );
  const glyph = style?.glyph ?? label.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="dg-glyph"
      data-long={glyph.length > 2}
      style={
        style?.color
          ? {
              color: style.color,
              backgroundColor: tint(style.color, 14),
              borderColor: tint(style.color, 34),
            }
          : undefined
      }
    >
      {glyph}
    </span>
  );
}

function KindTag({
  kind,
  active,
  onClick,
}: {
  kind: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const style = kindStyle(kind);
  const mark = style.icon ? (
    <KindIcon style={style} size={12} />
  ) : (
    <Dot color={style.color ?? "var(--color-muted)"} />
  );
  return onClick ? (
    <button
      type="button"
      className="dg-tag"
      onClick={onClick}
      aria-pressed={active}
      title={`Highlight ${style.label}`}
    >
      {mark}
      {style.label}
    </button>
  ) : (
    <span className="dg-tag">
      {mark}
      {style.label}
    </span>
  );
}

const GroupFrame = memo(function GroupFrame({
  frame,
  kinds,
  emphasised,
}: {
  frame: GraphFrame;
  kinds: string[];
  emphasised: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="dg-frame"
      data-emphasised={emphasised}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
      }}
    >
      <div className="dg-frame-header">
        <span className="dg-frame-title">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M1.5 4.5a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="1.3"
            />
          </svg>
          <span className="dg-frame-name" title={frame.group}>
            {frame.group}
          </span>
          <span className="dg-count">{frame.count}</span>
        </span>
        <span className="dg-frame-kinds">
          {kinds.map((kind) => (
            <KindTag key={kind} kind={kind} />
          ))}
        </span>
      </div>
    </div>
  );
});

const NodeCard = memo(function NodeCard({
  node,
  emphasis,
  selected,
  onActivate,
  onEnter,
  onLeave,
  onFocus,
}: {
  node: LaidOut;
  emphasis: Emphasis;
  selected: boolean;
  onActivate: (id: string) => void;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onFocus: (node: LaidOut) => void;
}) {
  const status = stateStyle(node.state);
  const tags = node.kinds.slice(0, MAX_TAGS);
  const hidden = node.kinds.length - tags.length;
  const check = node.checkState ? CHECK_STYLES[node.checkState] : undefined;
  return (
    <button
      type="button"
      className="dg-node"
      onClick={() => onActivate(node.id)}
      onMouseEnter={() => onEnter(node.id)}
      onMouseLeave={onLeave}
      onFocus={() => onFocus(node)}
      onBlur={onLeave}
      aria-pressed={selected}
      data-emphasis={emphasis}
      data-selected={selected}
      data-external={node.external}
      data-running={status.running}
      data-asset-state={node.state ?? "unknown"}
      title={`${node.label} — show details`}
      style={{
        left: node.x,
        top: node.y,
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
      }}
    >
      <span
        aria-hidden="true"
        className="dg-node-bar"
        style={{ backgroundColor: status.color }}
      />
      <span className="dg-node-body">
        <KindGlyph kind={node.kinds[0]} label={node.label} />
        <span className="dg-node-text">
          <span className="dg-node-title">
            <span className="dg-node-name">{node.label}</span>
            {check ? (
              <span
                className="dg-check"
                title={node.checkLabel}
                style={{
                  color: check.color,
                  borderColor: tint(check.color, 45),
                }}
              >
                {check.glyph}
              </span>
            ) : null}
          </span>
          <span className="dg-node-meta">
            <Dot color={status.color} />
            <span style={{ color: status.color, flexShrink: 0 }}>
              {node.stateLabel ?? status.label}
            </span>
            {node.caption ? (
              <span className="dg-node-caption">· {node.caption}</span>
            ) : null}
          </span>
        </span>
      </span>
      <span className="dg-node-kinds">
        {tags.length ? (
          tags.map((kind) => <KindTag key={kind} kind={kind} />)
        ) : (
          <span className="dg-count">no kinds</span>
        )}
        {hidden > 0 ? <span className="dg-count">+{hidden}</span> : null}
      </span>
    </button>
  );
});

function RelationList({
  title,
  ids,
  labelOf,
  onSelect,
}: {
  title: string;
  ids: string[];
  labelOf: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="dg-relations">
      <span className="dg-eyebrow">
        {title} · {ids.length}
      </span>
      {ids.length ? (
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="dg-chip"
                onClick={() => onSelect(id)}
              >
                {labelOf(id)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dg-none">None</p>
      )}
    </section>
  );
}

type ActionStatus =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; runId?: string }
  | { phase: "error"; message: string };

interface NodeAction {
  label: string;
  run: () => Promise<ActionStatus>;
}

function InspectorFooter({
  href,
  action,
  onNavigate,
  nodeId,
}: {
  href: string | null;
  action: NodeAction | undefined;
  onNavigate: (path: string) => void;
  nodeId: string;
}) {
  const [status, setStatus] = useState<ActionStatus>({ phase: "idle" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different node starts with a fresh action state
  useEffect(() => setStatus({ phase: "idle" }), [nodeId]);
  if (!href && !action) return null;
  return (
    <footer className="dg-panel-footer">
      {status.phase === "error" ? (
        <p className="dg-message dg-error" role="alert">
          {status.message}
        </p>
      ) : null}
      {status.phase === "done" ? (
        <p className="dg-message dg-success">
          Run launched
          {status.runId ? (
            <button
              type="button"
              className="dg-link"
              onClick={() => onNavigate(`/runs/${status.runId}`)}
            >
              View run →
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="dg-panel-actions">
        {action ? (
          <button
            type="button"
            className="dg-primary"
            disabled={status.phase === "running"}
            onClick={() => {
              setStatus({ phase: "running" });
              void action.run().then(setStatus);
            }}
          >
            {status.phase === "running" ? "Launching…" : action.label}
          </button>
        ) : null}
        {href ? (
          <button
            type="button"
            className="dg-secondary"
            onClick={() => onNavigate(href)}
          >
            Open details →
          </button>
        ) : null}
      </div>
    </footer>
  );
}

function Inspector({
  node,
  upstream,
  downstream,
  labelOf,
  href,
  action,
  onNavigate,
  onSelect,
  onClose,
  panelRef,
}: {
  node: LaidOut;
  upstream: string[];
  downstream: string[];
  labelOf: (id: string) => string;
  href: string | null;
  action: NodeAction | undefined;
  onNavigate: (path: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  panelRef: (element: HTMLElement | null) => void;
}) {
  const status = stateStyle(node.state);
  return (
    <aside
      ref={panelRef}
      className="dg-panel"
      aria-label={`${node.label} details`}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ width: PANEL_WIDTH }}
    >
      <header className="dg-panel-header">
        <KindGlyph kind={node.kinds[0]} label={node.label} />
        <div className="dg-panel-heading">
          <h3 className="dg-panel-title">{node.label}</h3>
          <span className="dg-panel-sub">
            <Dot color={status.color} />
            <span style={{ color: status.color }}>
              {node.stateLabel ?? status.label}
            </span>
            {node.group ? <span>· {node.group}</span> : null}
          </span>
        </div>
        <button
          type="button"
          className="dg-tool dg-close"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </header>
      <div className="dg-panel-body">
        {node.description ? (
          <p className="dg-description">{node.description}</p>
        ) : null}
        {node.external ? (
          <p className="dg-note">
            Outside this selection; shown to place it in context.
          </p>
        ) : null}
        {node.kinds.length ? (
          <div className="dg-tags">
            {node.kinds.map((kind) => (
              <KindTag key={kind} kind={kind} />
            ))}
          </div>
        ) : null}
        {node.details.length ? (
          <dl className="dg-details">
            {node.details.map(([key, value]) => (
              <div key={key} className="dg-detail">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <RelationList
          title="Upstream"
          ids={upstream}
          labelOf={labelOf}
          onSelect={onSelect}
        />
        <RelationList
          title="Downstream"
          ids={downstream}
          labelOf={labelOf}
          onSelect={onSelect}
        />
      </div>
      <InspectorFooter
        href={href}
        action={action}
        onNavigate={onNavigate}
        nodeId={node.id}
      />
    </aside>
  );
}

/** The inspector's action, with input read from the selected row. */
function nodeActionFor(
  client: ComponentClient,
  props: GraphProps,
  selected: LaidOut | undefined,
): NodeAction | undefined {
  const nodeAction = props.nodeAction;
  if (!selected || !nodeAction) return undefined;
  if (
    nodeAction.when &&
    selected.raw[nodeAction.when.field] !== nodeAction.when.equals
  )
    return undefined;
  return {
    label: nodeAction.label,
    run: async () => {
      const input = Object.fromEntries(
        Object.entries(nodeAction.input).map(([key, field]) => [
          key,
          selected.raw[field],
        ]),
      );
      try {
        const result = await client.executeAction({
          actionId: nodeAction.action.actionId,
          input,
        });
        if (result.status === "error")
          return {
            phase: "error",
            message: result.message ?? "Action failed",
          };
        const data = result.data as { runId?: unknown } | undefined;
        return {
          phase: "done",
          runId: typeof data?.runId === "string" ? data.runId : undefined,
        };
      } catch (cause) {
        return {
          phase: "error",
          message: cause instanceof Error ? cause.message : "Action failed",
        };
      }
    },
  };
}

/**
 * Pan and zoom for the board. The canvas never scrolls: dragging pans,
 * and the wheel or a pinch zooms around the pointer.
 */
function useViewport(canvas: HTMLDivElement | null, layout: GraphLayout) {
  const size = useCanvasSize(canvas);
  const [view, setView] = useState<View>({
    zoom: 1,
    x: 0,
    y: 0,
    smooth: false,
  });
  const placed = useRef(false);

  /** Keeps part of the board on screen at the given zoom. */
  const settle = useCallback(
    (next: View): View => {
      if (!size) return next;
      return {
        ...next,
        ...clampOffset(next, size, {
          width: layout.width * next.zoom,
          height: layout.height * next.zoom,
        }),
      };
    },
    [size, layout],
  );

  const zoomBy = useCallback(
    (factor: number, anchor: GraphOffset | undefined, smooth: boolean) => {
      if (!size) return;
      const point = anchor ?? { x: size.width / 2, y: size.height / 2 };
      setView((current) => {
        const zoom = clampZoom(current.zoom * factor);
        if (zoom === current.zoom) return current;
        return settle({
          zoom,
          ...zoomAround(current, point, current.zoom, zoom),
          smooth,
        });
      });
    },
    [size, settle],
  );

  const fit = useCallback(() => {
    if (!size) return;
    const zoom = fitZoom(size, layout);
    setView({
      zoom,
      ...restingOffset(size, {
        width: layout.width * zoom,
        height: layout.height * zoom,
      }),
      smooth: placed.current,
    });
    placed.current = true;
  }, [size, layout]);

  useEffect(() => {
    if (size && !placed.current) fit();
  }, [size, fit]);

  // Non-passive so the wheel zooms the board instead of scrolling the page.
  useEffect(() => {
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".dg-panel")) return;
      event.preventDefault();
      // Line-mode wheels report lines, not pixels.
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const speed = event.ctrlKey ? PINCH_ZOOM_SPEED : WHEEL_ZOOM_SPEED;
      const bounds = canvas.getBoundingClientRect();
      zoomBy(
        Math.exp(-delta * speed),
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        false,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvas, zoomBy]);

  const panTo = useCallback(
    (offset: GraphOffset) =>
      setView((current) => settle({ ...current, ...offset, smooth: false })),
    [settle],
  );

  /** Pans a node clear of the canvas edges and the inspector. */
  const reveal = useCallback(
    (node: LaidOut, inspected: boolean) => {
      if (!size) return;
      setView((current) => {
        const left = node.x * current.zoom;
        const top = node.y * current.zoom;
        const right = left + GRAPH_NODE_WIDTH * current.zoom;
        const bottom = top + GRAPH_NODE_HEIGHT * current.zoom;
        const edge =
          size.width -
          REVEAL_MARGIN -
          (inspected ? Math.min(PANEL_WIDTH, size.width) : 0);
        let { x, y } = current;
        if (right + x > edge) x = edge - right;
        if (left + x < REVEAL_MARGIN) x = REVEAL_MARGIN - left;
        if (bottom + y > size.height - REVEAL_MARGIN)
          y = size.height - REVEAL_MARGIN - bottom;
        if (top + y < REVEAL_MARGIN) y = REVEAL_MARGIN - top;
        return x === current.x && y === current.y
          ? current
          : { ...current, x, y, smooth: true };
      });
    },
    [size],
  );

  return { size, view, zoomBy, fit, panTo, reveal };
}

/** Starts a pan on pointer down; reports whether the gesture moved. */
function usePan(
  view: View,
  panTo: (offset: GraphOffset) => void,
): {
  panning: boolean;
  moved: React.MutableRefObject<boolean>;
  onPointerDown: (event: ReactPointerEvent) => void;
} {
  const [panning, setPanning] = useState(false);
  const origin = useRef<{ pointer: GraphOffset; offset: GraphOffset } | null>(
    null,
  );
  const moved = useRef(false);

  useEffect(() => {
    if (!panning) return;
    const onMove = (event: PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      const dx = event.clientX - start.pointer.x;
      const dy = event.clientY - start.pointer.y;
      if (!moved.current && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      moved.current = true;
      panTo({ x: start.offset.x + dx, y: start.offset.y + dy });
    };
    const onUp = () => setPanning(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panning, panTo]);

  return {
    panning,
    moved,
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      origin.current = {
        pointer: { x: event.clientX, y: event.clientY },
        offset: { x: view.x, y: view.y },
      };
      moved.current = false;
      setPanning(true);
    },
  };
}

/** Lineage and search emphasis for every node and edge. */
function useEmphasis(
  layout: GraphLayout<GraphRow>,
  active: string | undefined,
  query: string,
  kindFilter: string | undefined,
) {
  const { parents, children } = useMemo(() => {
    const up = new Map<string, string[]>();
    const down = new Map<string, string[]>();
    for (const edge of layout.edges) {
      up.set(edge.to, [...(up.get(edge.to) ?? []), edge.from]);
      down.set(edge.from, [...(down.get(edge.from) ?? []), edge.to]);
    }
    return { parents: up, children: down };
  }, [layout.edges]);

  const lineage = useMemo(
    () =>
      active
        ? {
            up: new Set([active, ...reach(active, parents)]),
            down: new Set([active, ...reach(active, children)]),
          }
        : undefined,
    [active, parents, children],
  );

  const matches = useMemo(() => {
    if (!query && !kindFilter) return undefined;
    return new Set(
      layout.nodes
        .filter(
          (node) =>
            (!query || node.label.toLowerCase().includes(query)) &&
            (!kindFilter ||
              node.kinds.some((kind) => kindKey(kind) === kindFilter)),
        )
        .map((node) => node.id),
    );
  }, [layout.nodes, query, kindFilter]);

  const emphasisOf = (id: string): Emphasis => {
    if (lineage) {
      if (id === active) return "active";
      return lineage.up.has(id) || lineage.down.has(id) ? "lineage" : "dimmed";
    }
    if (matches) return matches.has(id) ? "match" : "dimmed";
    return "idle";
  };

  const edgeLit = (from: string, to: string) =>
    !!lineage &&
    ((lineage.up.has(from) && lineage.up.has(to)) ||
      (lineage.down.has(from) && lineage.down.has(to)));

  return { parents, children, matches, emphasisOf, edgeLit, lineage };
}

/** Kind counts for the legend and each group frame's header. */
function useKindSummaries(nodes: readonly LaidOut[]) {
  return useMemo(() => {
    const legend = new Map<string, number>();
    const groups = new Map<string, Map<string, number>>();
    for (const node of nodes) {
      for (const kind of new Set(node.kinds.map(kindKey)))
        legend.set(kind, (legend.get(kind) ?? 0) + 1);
      if (!node.group) continue;
      const counts = groups.get(node.group) ?? new Map<string, number>();
      for (const kind of node.kinds)
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      groups.set(node.group, counts);
    }
    const byCount = (counts: Map<string, number>) =>
      [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      legend: byCount(legend),
      frameKinds: new Map(
        [...groups].map(([group, counts]) => [
          group,
          byCount(counts).map(([kind]) => kind),
        ]),
      ),
    };
  }, [nodes]);
}

function StateSummary({ nodes }: { nodes: readonly LaidOut[] }) {
  const summary = new Map<string, { color: string; count: number }>();
  for (const node of nodes) {
    if (!node.state || node.external) continue;
    const style = stateStyle(node.state);
    const label = node.stateLabel ?? style.label;
    const entry = summary.get(label) ?? { color: style.color, count: 0 };
    entry.count += 1;
    summary.set(label, entry);
  }
  if (!summary.size) return null;
  return (
    <span className="dg-summary">
      {[...summary].map(([label, { color, count }]) => (
        <span key={label} className="dg-summary-item" style={{ color }}>
          <Dot color={color} />
          {count} {label}
        </span>
      ))}
    </span>
  );
}

function GraphEdges({
  layout,
  edgeLit,
  faded,
}: {
  layout: GraphLayout<GraphRow>;
  edgeLit: (from: string, to: string) => boolean;
  faded: boolean;
}) {
  return (
    <svg
      className="dg-edges"
      width={layout.width}
      height={layout.height}
      role="presentation"
    >
      <defs>
        <marker
          id="dg-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0.5 L 8 4 L 0 7.5 z" fill="var(--color-muted)" />
        </marker>
        <marker
          id="dg-arrow-lit"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0.5 L 8 4 L 0 7.5 z" fill="var(--color-accent)" />
        </marker>
      </defs>
      {layout.edges.map((edge) => {
        const lit = edgeLit(edge.from, edge.to);
        return (
          <path
            key={`${edge.from}->${edge.to}`}
            className="dg-edge"
            data-lit={lit}
            data-faded={faded && !lit}
            d={edge.path}
            markerEnd={`url(#${lit ? "dg-arrow-lit" : "dg-arrow"})`}
          />
        );
      })}
    </svg>
  );
}

function GraphBoard({
  client,
  layout,
  props,
}: {
  client: ComponentClient;
  layout: GraphLayout<GraphRow>;
  props: GraphProps;
}) {
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>();
  const panel = useRef<HTMLElement | null>(null);
  const { size, view, zoomBy, fit, panTo, reveal } = useViewport(
    canvas,
    layout,
  );
  const { panning, moved, onPointerDown } = usePan(view, panTo);
  const noun = props.noun ?? "asset";
  const active = hovered ?? selectedId;
  const { parents, children, matches, emphasisOf, edgeLit, lineage } =
    useEmphasis(layout, active, search.trim().toLowerCase(), kindFilter);
  const { legend, frameKinds } = useKindSummaries(layout.nodes);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  const byId = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );

  const inspect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const target = byId.get(id);
      if (target) reveal(target, true);
    },
    [byId, reveal],
  );
  const handleEnter = useCallback((id: string) => setHovered(id), []);
  const handleLeave = useCallback(() => setHovered(undefined), []);
  const handleFocus = useCallback(
    (node: LaidOut) => {
      setHovered(node.id);
      reveal(node, !!selectedId);
    },
    [reveal, selectedId],
  );

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const activeGroup = active ? byId.get(active)?.group : undefined;

  return (
    <div className="dg">
      <div className="dg-toolbar">
        <span className="dg-eyebrow">
          {plural(layout.nodes.length, noun)} ·{" "}
          {plural(layout.edges.length, "edge")}
          {layout.frames.length
            ? ` · ${plural(layout.frames.length, "group")}`
            : ""}
        </span>
        <StateSummary nodes={layout.nodes} />
        <div className="dg-controls">
          <input
            type="search"
            className="dg-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !matches) return;
              const first = layout.nodes.find((node) => matches.has(node.id));
              if (first) inspect(first.id);
            }}
            placeholder={`Find ${noun}…`}
            aria-label={`Find ${noun}`}
          />
          <button
            type="button"
            className="dg-tool"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR, undefined, true)}
          >
            −
          </button>
          <span className="dg-zoom">{Math.round(view.zoom * 100)}%</span>
          <button
            type="button"
            className="dg-tool"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => zoomBy(BUTTON_ZOOM_FACTOR, undefined, true)}
          >
            +
          </button>
          <button
            type="button"
            className="dg-tool"
            title="Fit to view"
            onClick={fit}
          >
            Fit
          </button>
        </div>
      </div>
      {legend.length ? (
        <div className="dg-legend">
          <span className="dg-eyebrow">Kinds</span>
          {legend.map(([kind, count]) => (
            <span key={kind} className="dg-legend-item">
              <KindTag
                kind={kind}
                active={kindFilter === kind}
                onClick={() =>
                  setKindFilter((current) =>
                    current === kind ? undefined : kind,
                  )
                }
              />
              <span className="dg-count">{count}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div
        ref={setCanvas}
        className="dg-canvas"
        data-panning={panning}
        onPointerDown={onPointerDown}
        onClickCapture={(event) => {
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
            return;
          }
          // A click on empty canvas closes the inspector.
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest("button") || panel.current?.contains(target))
            return;
          setSelectedId(undefined);
        }}
        style={{ height: size?.height ?? MIN_CANVAS_HEIGHT }}
      >
        <div
          className="dg-board"
          data-smooth={view.smooth && !panning}
          style={
            {
              width: layout.width,
              height: layout.height,
              // Whole-pixel offsets keep text off half pixels.
              transform: `translate(${Math.round(view.x)}px, ${Math.round(view.y)}px) scale(${view.zoom})`,
            } satisfies CSSProperties
          }
        >
          {layout.frames.map((frame) => (
            <GroupFrame
              key={frame.group}
              frame={frame}
              kinds={frameKinds.get(frame.group) ?? []}
              emphasised={frame.group === activeGroup}
            />
          ))}
          <GraphEdges
            layout={layout}
            edgeLit={edgeLit}
            faded={!!lineage || !!matches}
          />
          {layout.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              emphasis={emphasisOf(node.id)}
              selected={node.id === selectedId}
              onActivate={inspect}
              onEnter={handleEnter}
              onLeave={handleLeave}
              onFocus={handleFocus}
            />
          ))}
        </div>
        <span className="dg-eyebrow dg-hint">
          drag to move · scroll to zoom · hover to trace lineage
        </span>
        {selected ? (
          <Inspector
            node={selected}
            upstream={parents.get(selected.id) ?? []}
            downstream={children.get(selected.id) ?? []}
            labelOf={(id) => byId.get(id)?.label ?? id}
            href={
              props.rowLink
                ? resolveLink(
                    props.rowLink.path,
                    props.rowLink.params,
                    selected.raw,
                  )
                : null
            }
            action={nodeActionFor(client, props, selected)}
            onNavigate={(path) => client.navigate(path)}
            onSelect={inspect}
            onClose={() => setSelectedId(undefined)}
            panelRef={(element) => {
              panel.current = element;
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function topologyKey(rows: readonly GraphRow[]) {
  return rows
    .map((row) => `${row.id}@${row.group ?? ""}:${row.dependsOn.join(",")}`)
    .join(";");
}

/** Polls the source; positions survive refreshes that keep the topology. */
function useGraphData(client: ComponentClient, props: GraphProps) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState<string>();
  const cached = useRef<{ key: string; layout: GraphLayout<GraphRow> } | null>(
    null,
  );
  const refreshMs = props.refreshMs ?? 10_000;

  useEffect(() => {
    const source = props.source;
    if (!source) return;
    let live = true;
    const load = () => {
      void client
        .executeResource(source)
        .then((result) => {
          if (!live) return;
          setData(result);
          setError(undefined);
        })
        .catch((cause) => {
          if (live)
            setError(cause instanceof Error ? cause.message : "Could not load");
        });
    };
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [client, props.source, refreshMs]);

  const layout = useMemo(() => {
    const rows = (Array.isArray(data) ? data : []).flatMap((row) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? (graphRow(row as Record<string, unknown>) ?? [])
        : [],
    );
    if (!rows.length) return null;
    const key = topologyKey(rows);
    if (cached.current?.key !== key) {
      cached.current = { key, layout: layoutGraph(rows) };
      return cached.current.layout;
    }
    const fresh = new Map(rows.map((row) => [row.id, row]));
    const base = cached.current.layout;
    return {
      ...base,
      nodes: base.nodes.map((node) => {
        const row = fresh.get(node.id);
        return row ? { ...node, ...row, x: node.x, y: node.y } : node;
      }),
    };
  }, [data]);

  return { data, error, layout };
}

function AssetGraphContent({
  client,
  props,
}: {
  client: ComponentClient;
  props: GraphProps;
}) {
  const { data, error, layout } = useGraphData(client, props);
  let content: ReactElement;
  if (error && !data)
    content = (
      <div className="dg-status dg-error" role="alert">
        {error}
      </div>
    );
  else if (!data)
    content = (
      <div className="dg-status" aria-busy="true">
        Loading graph…
      </div>
    );
  else if (!layout)
    content = (
      <div className="dg-status">
        {props.emptyMessage ?? "Nothing to show."}
      </div>
    );
  else
    content = (
      <div className="dg-stack">
        {error ? (
          <p className="dg-message dg-error" role="alert">
            Live refresh failed: {error}
          </p>
        ) : null}
        <GraphBoard client={client} layout={layout} props={props} />
      </div>
    );
  return (
    <>
      <style>{GRAPH_STYLES}</style>
      {content}
    </>
  );
}

export function AssetGraphView({
  client,
  node,
}: {
  client: ComponentClient;
  node: PageNode;
}) {
  if (node.kind !== "custom" || node.props.component !== "dagster/asset-graph")
    return null;
  const props = (node as AssetGraphNode).props.props;
  if (!props) return null;
  return (
    <AssetGraphContent
      key={JSON.stringify(props.source ?? null)}
      client={client}
      props={props}
    />
  );
}

export default AssetGraphView;
