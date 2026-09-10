import type { PageNode, TableRowLink } from "@northgraindata/dsui-core";
import { cn, Surface } from "@northgraindata/dsui-ui";
import {
  Fragment,
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clampOffset,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  type GraphLaidOutNode,
  type GraphLayout,
  type GraphOffset,
  type GraphSize,
  graphNodeFromRow,
  layoutDependencyGraph,
  restingOffset,
} from "./graph-layout";
import { resolveLink } from "./ResourceViews";
import { watchResource } from "./resource-refresh";
import type { RendererClient } from "./types";

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.35] as const;
const DEFAULT_ZOOM_INDEX = 3;
/**
 * Workspace bottom padding plus the panel border, so filling the viewport
 * does not push the page into a scrollbar of its own.
 */
const CANVAS_BOTTOM_GUTTER = 30;
const MIN_CANVAS_HEIGHT = 360;
/** Pointer travel that turns a click into a pan. */
const PAN_THRESHOLD = 4;
/** Breathing room when panning a node into view. */
const REVEAL_MARGIN = 24;
/** Inspector drawer, kept clear of the node it describes. */
const PANEL_WIDTH = 320;

/** Dotted canvas grid, drawn from the same border token as every panel. */
const CANVAS_GRID = {
  backgroundImage:
    "radial-gradient(var(--color-border) 1px, transparent 1px), radial-gradient(var(--color-border) 1px, transparent 1px)",
  backgroundSize: "22px 22px, 22px 22px",
  backgroundPosition: "0 0, 11px 11px",
};

type Size = GraphSize;
type Offset = GraphOffset;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Fills the viewport from the canvas down to the bottom of the page and
 * tracks the space available for centring.
 */
function useCanvasSize(element: HTMLElement | null) {
  const [size, setSize] = useState<Size>();
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

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center border border-border bg-surface font-mono text-[12px] leading-none text-secondary transition-colors hover:border-border-strong hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-secondary"
    >
      {children}
    </button>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Related tasks, clickable so the inspector doubles as graph navigation. */
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
    <section className="grid gap-1.5">
      <h4 className="m-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      {ids.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {ids.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="max-w-full truncate border border-border bg-surface px-2 py-1 text-[11px] text-secondary transition-colors hover:border-accent hover:text-primary"
              >
                {labelOf(id)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[11px] text-muted">None</p>
      )}
    </section>
  );
}

/** Airflow-style drawer describing the task the user clicked. */
function NodeInspector({
  node,
  row,
  hiddenFields,
  upstream,
  downstream,
  labelOf,
  onOpen,
  onSelect,
  onClose,
  panelRef,
}: {
  node: GraphLaidOutNode;
  row: Record<string, unknown> | undefined;
  hiddenFields: ReadonlySet<string>;
  upstream: string[];
  downstream: string[];
  labelOf: (id: string) => string;
  onOpen: (() => void) | undefined;
  onSelect: (id: string) => void;
  onClose: () => void;
  panelRef: (element: HTMLElement | null) => void;
}) {
  const fields = Object.entries(row ?? {}).filter(
    ([key]) => !hiddenFields.has(key),
  );
  return (
    <aside
      ref={panelRef}
      aria-label={`${node.label} details`}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ width: PANEL_WIDTH }}
      className="absolute inset-y-0 right-0 flex max-w-full cursor-auto flex-col border-l border-border bg-surface shadow-[-8px_0_24px_-16px_rgb(0_0_0/0.6)]"
    >
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="m-0 truncate text-[13px] font-medium text-primary">
            {node.label}
          </h3>
          <span className="truncate font-mono text-[10px] text-muted">
            {node.id}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task details"
          className="ml-auto grid h-6 w-6 shrink-0 place-items-center border border-border bg-surface text-[12px] leading-none text-secondary transition-colors hover:border-border-strong hover:text-primary"
        >
          ×
        </button>
      </header>
      <div className="grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto px-4 py-3">
        {fields.length ? (
          <dl className="m-0 grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-2 text-[11.5px]">
            {fields.map(([key, value]) => (
              <Fragment key={key}>
                <dt className="truncate text-secondary">{key}</dt>
                <dd className="m-0 break-words text-primary">
                  {formatValue(value)}
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : null}
        <RelationList
          title="Depends on"
          ids={upstream}
          labelOf={labelOf}
          onSelect={onSelect}
        />
        <RelationList
          title="Feeds"
          ids={downstream}
          labelOf={labelOf}
          onSelect={onSelect}
        />
      </div>
      {onOpen ? (
        <footer className="mt-auto border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onOpen}
            className="border border-border bg-surface px-2.5 py-1.5 text-[11.5px] text-secondary transition-colors hover:border-accent hover:text-primary"
          >
            Open full details →
          </button>
        </footer>
      ) : null}
    </aside>
  );
}

function getTaskStateConfig(state: string | undefined) {
  const s = state?.trim().toLowerCase();
  switch (s) {
    case "success":
      return {
        bg: "bg-healthy/15",
        text: "text-healthy",
        dot: "bg-healthy",
        border: "border-healthy/30",
        pulse: false,
      };
    case "failed":
    case "upstream_failed":
      return {
        bg: "bg-unavailable/15",
        text: "text-unavailable",
        dot: "bg-unavailable",
        border: "border-unavailable/30",
        pulse: false,
      };
    case "running":
    case "restarting":
      return {
        bg: "bg-accent/15",
        text: "text-accent",
        dot: "bg-accent",
        border: "border-accent/40",
        pulse: true,
      };
    case "queued":
    case "scheduled":
    case "deferred":
    case "up_for_retry":
    case "up_for_reschedule":
      return {
        bg: "bg-warning/15",
        text: "text-warning",
        dot: "bg-warning",
        border: "border-warning/30",
        pulse: false,
      };
    case "awaiting":
    case "none":
    default:
      return {
        bg: "bg-unknown/15",
        text: "text-muted",
        dot: "bg-unknown",
        border: "border-unknown/30",
        pulse: false,
      };
  }
}

const GraphNodeCard = memo(function GraphNodeCard({
  node,
  state,
  selected,
  onActivate,
  onEnter,
  onLeave,
  onFocus,
}: {
  node: GraphLaidOutNode;
  state: "active" | "linked" | "idle" | "dimmed";
  selected: boolean;
  onActivate: (id: string) => void;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onFocus: (node: GraphLaidOutNode) => void;
}) {
  const glyph = node.detail?.trim().charAt(0).toUpperCase();
  const normalizedState = node.state?.trim().toLowerCase();
  const stateConfig = getTaskStateConfig(node.state);
  const isRunning =
    normalizedState === "running" || normalizedState === "restarting";

  return (
    <button
      type="button"
      onClick={() => onActivate(node.id)}
      onMouseEnter={() => onEnter(node.id)}
      onMouseLeave={onLeave}
      onFocus={() => onFocus(node)}
      onBlur={onLeave}
      aria-pressed={selected}
      title={`${node.label} — show details`}
      style={{
        left: node.x,
        top: node.y,
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
      }}
      className={cn(
        "absolute flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-md border pr-3 pl-4 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-accent motion-reduce:transition-none",
        selected && "ring-1 ring-accent",
        isRunning && "border-accent/50 shadow-[0_0_8px_rgba(107,138,255,0.15)]",
        state === "active"
          ? "border-accent bg-surface-hover shadow-[0_0_0_1px_var(--color-accent)]"
          : state === "linked"
            ? "border-accent/45 bg-surface-raised"
            : state === "dimmed"
              ? "border-border bg-surface-raised opacity-45"
              : "border-border bg-surface-raised hover:border-border-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] transition-colors",
          state === "active" || state === "linked"
            ? "bg-accent"
            : node.state
              ? stateConfig.dot
              : "bg-border-strong",
        )}
      />
      {glyph ? (
        <span
          aria-hidden="true"
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded border font-mono text-[11px] transition-colors",
            state === "active" || state === "linked"
              ? "border-accent/50 text-accent"
              : "border-border text-muted",
          )}
        >
          {glyph}
        </span>
      ) : null}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-[12.5px] font-medium text-primary">
          {node.label}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {node.state ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] lowercase leading-none",
                stateConfig.bg,
                stateConfig.text,
                stateConfig.border,
              )}
            >
              <i
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  stateConfig.dot,
                  stateConfig.pulse &&
                    "animate-pulse motion-reduce:animate-none",
                )}
              />
              {node.state.replaceAll("_", " ")}
            </span>
          ) : null}
          {node.detail ? (
            <span className="truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
              {node.detail}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
});

/**
 * Free-moving board: the canvas never scrolls, the graph is translated
 * under it by dragging or the wheel.
 */
function GraphBoard({
  client,
  layout,
  rows,
  rowLink,
  hiddenFields,
}: {
  client: RendererClient;
  layout: GraphLayout;
  rows: Map<string, Record<string, unknown>>;
  rowLink: TableRowLink | undefined;
  hiddenFields: ReadonlySet<string>;
}) {
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const placed = useRef(false);
  const panel = useRef<HTMLElement | null>(null);
  const origin = useRef<{ pointer: Offset; offset: Offset } | null>(null);
  const moved = useRef(false);
  const size = useCanvasSize(canvas);
  const zoom = ZOOM_STEPS[zoomIndex];
  const board = useMemo(
    () => ({ width: layout.width * zoom, height: layout.height * zoom }),
    [layout, zoom],
  );

  const settle = useCallback(
    (next: Offset) => {
      setOffset(size ? clampOffset(next, size, board) : next);
    },
    [size, board],
  );

  useEffect(() => {
    if (!size || placed.current) return;
    placed.current = true;
    setOffset(restingOffset(size, board));
  }, [size, board]);

  useEffect(() => {
    if (!panning) return;
    const onMove = (event: PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      const dx = event.clientX - start.pointer.x;
      const dy = event.clientY - start.pointer.y;
      if (!moved.current && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      moved.current = true;
      settle({ x: start.offset.x + dx, y: start.offset.y + dy });
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
  }, [panning, settle]);

  // Non-passive so the wheel moves the board instead of the page.
  useEffect(() => {
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (target instanceof Node && panel.current?.contains(target)) return;
      event.preventDefault();
      setOffset((current) => {
        const next = {
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        };
        return size ? clampOffset(next, size, board) : next;
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvas, size, board]);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  const changeZoom = (nextIndex: number) => {
    const nextZoom = ZOOM_STEPS[nextIndex];
    const ratio = nextZoom / zoom;
    setZoomIndex(nextIndex);
    if (!size) return;
    const centre = { x: size.width / 2, y: size.height / 2 };
    const nextBoard = {
      width: layout.width * nextZoom,
      height: layout.height * nextZoom,
    };
    setOffset((current) =>
      clampOffset(
        {
          x: centre.x - (centre.x - current.x) * ratio,
          y: centre.y - (centre.y - current.y) * ratio,
        },
        size,
        nextBoard,
      ),
    );
  };

  const resetView = () => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
    if (!size) return;
    setOffset(
      restingOffset(size, {
        width: layout.width * ZOOM_STEPS[DEFAULT_ZOOM_INDEX],
        height: layout.height * ZOOM_STEPS[DEFAULT_ZOOM_INDEX],
      }),
    );
  };

  /**
   * Pans a node into the free area of the canvas: there is no scroll
   * container to fall back on, and the inspector covers the right edge.
   */
  const reveal = useCallback(
    (node: GraphLaidOutNode, inspected: boolean) => {
      if (!size) return;
      const left = node.x * zoom;
      const top = node.y * zoom;
      const right = left + GRAPH_NODE_WIDTH * zoom;
      const bottom = top + GRAPH_NODE_HEIGHT * zoom;
      const edge =
        size.width -
        REVEAL_MARGIN -
        (inspected ? Math.min(PANEL_WIDTH, size.width) : 0);
      setOffset((current) => {
        let { x, y } = current;
        if (right + x > edge) x = edge - right;
        if (left + x < REVEAL_MARGIN) x = REVEAL_MARGIN - left;
        if (bottom + y > size.height - REVEAL_MARGIN)
          y = size.height - REVEAL_MARGIN - bottom;
        if (top + y < REVEAL_MARGIN) y = REVEAL_MARGIN - top;
        return x === current.x && y === current.y ? current : { x, y };
      });
    },
    [size, zoom],
  );

  const inspect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const target = layout.nodes.find((candidate) => candidate.id === id);
      if (target) reveal(target, true);
    },
    [layout.nodes, reveal],
  );

  const handleActivate = useCallback((id: string) => inspect(id), [inspect]);
  const handleEnter = useCallback((id: string) => setHovered(id), []);
  const handleLeave = useCallback(() => setHovered(undefined), []);
  const handleFocus = useCallback(
    (node: GraphLaidOutNode) => {
      setHovered(node.id);
      reveal(node, !!selectedId);
    },
    [reveal, selectedId],
  );

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    origin.current = {
      pointer: { x: event.clientX, y: event.clientY },
      offset,
    };
    moved.current = false;
    setPanning(true);
  };

  const active = hovered ?? selectedId;
  const selected = layout.nodes.find((node) => node.id === selectedId);
  const labelOf = (id: string) =>
    layout.nodes.find((node) => node.id === id)?.label ?? id;
  const selectedRow = selected ? rows.get(selected.id) : undefined;
  const selectedHref =
    rowLink && selectedRow
      ? resolveLink(rowLink.path, rowLink.params, selectedRow)
      : null;
  const linked = new Set(
    active
      ? layout.edges
          .filter((edge) => edge.from === active || edge.to === active)
          .flatMap((edge) => [edge.from, edge.to])
      : [],
  );
  const stateOf = (id: string) => {
    if (!active) return "idle" as const;
    if (id === active) return "active" as const;
    return linked.has(id) ? ("linked" as const) : ("dimmed" as const);
  };

  const stateSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of layout.nodes) {
      if (!node.state) continue;
      const s = node.state.trim().toLowerCase();
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const order = [
      "running",
      "success",
      "failed",
      "upstream_failed",
      "queued",
      "scheduled",
      "awaiting",
    ];
    return Array.from(counts.entries()).sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [layout.nodes]);

  return (
    <Surface className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-raised px-4 py-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
          {plural(layout.nodes.length, "task")} ·{" "}
          {plural(layout.edges.length, "dependency")}
        </span>
        {stateSummary.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {stateSummary.map(([st, count]) => {
              const cfg = getTaskStateConfig(st);
              return (
                <span
                  key={st}
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px] lowercase leading-none",
                    cfg.bg,
                    cfg.text,
                    cfg.border,
                  )}
                >
                  <i
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      cfg.dot,
                      cfg.pulse && "animate-pulse motion-reduce:animate-none",
                    )}
                  />
                  <span>
                    {count} {st.replaceAll("_", " ")}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted/70">
          drag to move
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <ZoomButton
            label="Zoom out"
            disabled={zoomIndex === 0}
            onClick={() => changeZoom(Math.max(0, zoomIndex - 1))}
          >
            −
          </ZoomButton>
          <button
            type="button"
            onClick={resetView}
            title="Reset view"
            className="min-w-11 border border-transparent px-1 font-mono text-[10px] text-secondary transition-colors hover:text-primary"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ZoomButton
            label="Zoom in"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() =>
              changeZoom(Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1))
            }
          >
            +
          </ZoomButton>
        </div>
      </div>
      <div
        ref={setCanvas}
        onPointerDown={onPointerDown}
        onClickCapture={(event) => {
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
            return;
          }
          // A click on empty canvas, next to no task, closes the inspector.
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest("button") || panel.current?.contains(target))
            return;
          setSelectedId(undefined);
        }}
        style={{ ...CANVAS_GRID, height: size?.height ?? MIN_CANVAS_HEIGHT }}
        className={cn(
          "relative touch-none overflow-hidden bg-canvas",
          panning ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-0 origin-top-left",
            !panning &&
              "transition-transform duration-150 motion-reduce:transition-none",
          )}
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            role="presentation"
          >
            <title>Dependency edges</title>
            <defs>
              <marker
                id="dependency-graph-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M 0 0.5 L 8 4 L 0 7.5 z" fill="currentColor" />
              </marker>
            </defs>
            {layout.edges.map((edge) => {
              const lit =
                active && (edge.from === active || edge.to === active);
              return (
                <path
                  key={`${edge.from}->${edge.to}`}
                  d={edge.path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={lit ? 1.75 : 1.25}
                  markerEnd="url(#dependency-graph-arrow)"
                  className={cn(
                    "transition-colors",
                    lit
                      ? "text-accent"
                      : active
                        ? "text-border"
                        : "text-border-strong",
                  )}
                />
              );
            })}
          </svg>
          {layout.nodes.map((node) => (
            <GraphNodeCard
              key={node.id}
              node={node}
              state={stateOf(node.id)}
              selected={node.id === selectedId}
              onActivate={handleActivate}
              onEnter={handleEnter}
              onLeave={handleLeave}
              onFocus={handleFocus}
            />
          ))}
        </div>
        {selected ? (
          <NodeInspector
            node={selected}
            row={selectedRow}
            hiddenFields={hiddenFields}
            upstream={layout.edges
              .filter((edge) => edge.to === selected.id)
              .map((edge) => edge.from)}
            downstream={layout.edges
              .filter((edge) => edge.from === selected.id)
              .map((edge) => edge.to)}
            labelOf={labelOf}
            onOpen={
              selectedHref ? () => client.navigate(selectedHref) : undefined
            }
            onSelect={inspect}
            onClose={() => setSelectedId(undefined)}
            panelRef={(element) => {
              panel.current = element;
            }}
          />
        ) : null}
      </div>
    </Surface>
  );
}

export function DependencyGraphView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "dependency-graph" }>;
}) {
  const [data, setData] = useState<unknown>(node.props.data);
  const [error, setError] = useState<string>();
  const cachedLayoutRef = useRef<{
    topologyKey: string;
    baseLayout: GraphLayout;
  } | null>(null);

  useEffect(() => {
    if (!node.props.source) return;
    return watchResource(
      node.props.source,
      (reference) => client.executeResource(reference),
      (result) => {
        setData(result);
        setError(undefined);
      },
      (cause) =>
        setError(cause instanceof Error ? cause.message : "Could not load"),
    );
  }, [client, node.props.source]);

  const { parsed, rows } = useMemo(() => {
    const source = Array.isArray(data)
      ? data.filter(
          (row): row is Record<string, unknown> =>
            !!row && typeof row === "object" && !Array.isArray(row),
        )
      : [];
    const rowsMap = new Map<string, Record<string, unknown>>();
    const parsedNodes = source.flatMap((row) => {
      const graphNode = graphNodeFromRow(row, node.props);
      if (!graphNode) return [];
      rowsMap.set(graphNode.id, row);
      return [graphNode];
    });
    return { parsed: parsedNodes, rows: rowsMap };
  }, [data, node.props]);

  const layout = useMemo(() => {
    if (!parsed.length) return null;
    const topologyKey = parsed
      .map((n) => `${n.id}:${n.dependsOn.join(",")}`)
      .join(";");

    if (
      !cachedLayoutRef.current ||
      cachedLayoutRef.current.topologyKey !== topologyKey
    ) {
      cachedLayoutRef.current = {
        topologyKey,
        baseLayout: layoutDependencyGraph(parsed),
      };
      return cachedLayoutRef.current.baseLayout;
    }

    const base = cachedLayoutRef.current.baseLayout;
    const nodeLookup = new Map(parsed.map((n) => [n.id, n]));
    let anyChanged = false;

    const nextNodes = base.nodes.map((baseNode) => {
      const updated = nodeLookup.get(baseNode.id);
      if (!updated) return baseNode;
      if (
        baseNode.state === updated.state &&
        baseNode.label === updated.label &&
        baseNode.detail === updated.detail
      ) {
        return baseNode;
      }
      anyChanged = true;
      return {
        ...baseNode,
        state: updated.state,
        label: updated.label,
        detail: updated.detail,
      };
    });

    if (!anyChanged) {
      return base;
    }

    return {
      ...base,
      nodes: nextNodes,
    };
  }, [parsed]);

  if (error && !data)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!data)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading graph…
      </Surface>
    );
  if (!layout || !parsed.length)
    return (
      <Surface className="p-5 text-[12px] text-secondary">
        No dependencies.
      </Surface>
    );
  return (
    <div className="grid gap-2">
      {error ? (
        <p className="m-0 text-[11px] text-unavailable" role="alert">
          Live refresh failed: {error}
        </p>
      ) : null}
      <GraphBoard
        client={client}
        layout={layout}
        rows={rows}
        rowLink={node.props.rowLink}
        // The inspector shows these as its heading and relation lists already.
        hiddenFields={new Set([node.props.idField, node.props.dependsOnField])}
      />
    </div>
  );
}
