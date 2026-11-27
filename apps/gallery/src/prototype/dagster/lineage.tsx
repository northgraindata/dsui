/* The asset graph: groups first, assets when asked for. */
import { Button } from "@northgraindata/dsui-ui";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Glyph } from "../shared/glyphs";
import { useRemembered } from "../shared/list";
import { go, IconButton } from "../shared/ui";
import {
  type AssetNow,
  assetNow,
  assetStates,
  failing,
  partitionsOf,
} from "./catalog";
import { assetByKey, assets, downstream, reach } from "./graph";
import { type Box, CARD, layout, NODE } from "./layout";
import { MaterializeDialog } from "./materialize";
import {
  assetPath,
  CheckCount,
  Dot,
  KindMark,
  Kinds,
  PartitionBar,
  Pill,
  runPath,
  stateLine,
} from "./parts";
import { selectAssets } from "./select";
import { stamp } from "./time";

const filters: [
  id: string,
  label: string,
  tone: string,
  test: (item: AssetNow) => boolean,
][] = [
  ["failed", "Failed", "failed", (item) => item.state === "failed"],
  [
    "checks",
    "Failing checks",
    "up_for_retry",
    (item) => failing(item).length > 0,
  ],
  ["stale", "Stale", "up_for_retry", (item) => item.state === "stale"],
  [
    "materializing",
    "Materializing",
    "running",
    (item) => item.state === "materializing",
  ],
  ["never", "Never materialized", "none", (item) => item.state === "never"],
];

interface View {
  x: number;
  y: number;
  zoom: number;
}

const clamp = (zoom: number) => Math.min(1.6, Math.max(0.2, zoom));

const curve = (from: Box, to: Box) => {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const bend = Math.max(40, (x2 - x1) / 2);
  return `M${x1} ${y1}C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
};

function AssetCard({ item }: { item: AssetNow }) {
  const partitions = partitionsOf(item.def.key);
  return (
    <>
      <span className="dx-node-name">
        <KindMark kind={item.def.kinds[0] ?? ""} />
        <strong title={item.def.name}>{item.def.name}</strong>
      </span>
      <span className="dx-node-state">
        <Dot tone={assetStates[item.state][1]} />
        {stateLine(item)}
      </span>
      <span className="dx-node-facts">
        {item.checks.length ? <CheckCount item={item} /> : null}
        {item.freshness && !item.freshness.passing ? (
          <span className="dx-checks" data-state="up_for_retry">
            <Glyph name="clock" size={11} />
            Overdue
          </span>
        ) : null}
        {partitions ? (
          <PartitionBar partitions={partitions} label={false} />
        ) : null}
      </span>
    </>
  );
}

const short: Record<string, (count: number) => string> = {
  failed: () => "failed",
  checks: (count) => (count === 1 ? "bad check" : "bad checks"),
  stale: () => "stale",
  materializing: () => "running",
  never: () => "new",
};

function GroupSummary({ keys }: { keys: readonly string[] }) {
  const items = keys.map((key) => assetNow.get(key) as AssetNow);
  const counts = filters
    .map(
      ([id, label, tone, test]) =>
        [id, label, tone, items.filter(test).length] as const,
    )
    .filter(([, , , count]) => count);
  return (
    <span className="dx-group-states">
      {counts.length ? (
        counts.map(([id, label, tone, count]) => (
          <span
            key={id}
            title={`${count}: ${label.toLowerCase()}`}
            data-state={tone}
          >
            <Dot tone={tone} />
            {count} {short[id]?.(count)}
          </span>
        ))
      ) : (
        <span data-state="success">
          <Dot tone="success" />
          All fine
        </span>
      )}
    </span>
  );
}

export function Lineage({
  only,
  openAll = false,
  stateKey,
  initialQuery = "",
  focusKey,
}: {
  /** Restricts the graph to these assets, such as a job's. */
  only?: readonly string[];
  openAll?: boolean;
  /** Where the view's choices are remembered. */
  stateKey: string;
  initialQuery?: string;
  focusKey?: string;
}) {
  const [query, setQuery] = useRemembered(
    `dx:lineage:${stateKey}:query`,
    initialQuery,
  );
  const [opened, setOpened] = useRemembered<readonly string[]>(
    `dx:lineage:${stateKey}:open`,
    [],
  );
  const [filter, setFilter] = useState("");
  const [chosen, setPicked] = useState<readonly string[]>(
    focusKey ? [focusKey] : [],
  );
  const [hovered, setHovered] = useState<string>();
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [moved, setMoved] = useState(false);
  const [dialog, setDialog] = useState<readonly string[]>();
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; view: View }>(undefined);

  const scope = useMemo(
    () => (only ? assets.filter((asset) => only.includes(asset.key)) : assets),
    [only],
  );
  const selection = selectAssets(query);
  const shown = selection
    ? scope.filter((asset) => selection.has(asset.key))
    : scope;
  // An asset the query hides is no longer picked.
  const picked = chosen.filter((key) =>
    shown.some((asset) => asset.key === key),
  );
  const everyGroup = [...new Set(shown.map((asset) => asset.group))];
  // A selection is small and meant to be read, so its groups start open.
  const open = new Set(openAll || selection ? everyGroup : opened);
  const signature = `${shown.map((asset) => asset.key).join()}|${[...open].join()}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature stands for both inputs
  const made = useMemo(() => layout(shown, open), [signature]);

  const fit = (
    box: Box = { x: 0, y: 0, width: made.width, height: made.height },
    least = 0.2,
  ) => {
    const frame = canvas.current;
    if (!frame || !box.width) return;
    const room = {
      width: frame.clientWidth - 32,
      height: frame.clientHeight - 32,
    };
    const zoom = clamp(
      Math.max(
        least,
        Math.min(1, room.width / box.width, room.height / box.height),
      ),
    );
    // What does not fit starts at its beginning, where the sources are.
    const start = (size: number, length: number, from: number) =>
      length * zoom > size - 32
        ? 16 - from * zoom
        : (size - length * zoom) / 2 - from * zoom;
    setView({
      zoom,
      x: start(frame.clientWidth, box.width, box.x),
      y: start(frame.clientHeight, box.height, box.y),
    });
  };

  const target = useRef<string>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refits when the graph changes
  useEffect(() => {
    const wanted = target.current;
    target.current = undefined;
    const group = made.groups.find((item) => item.name === wanted);
    const node = made.nodes.find(
      (item) => item.key === (wanted ?? (moved ? undefined : focusKey)),
    );
    if (group) fit(group, 0.75);
    else if (node)
      fit(
        {
          x: node.x - 220,
          y: node.y - 120,
          width: node.width + 440,
          height: node.height + 240,
        },
        0.8,
      );
    else fit(undefined, 0.66);
  }, [signature]);

  useEffect(() => {
    const frame = canvas.current;
    if (!frame) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setMoved(true);
      setView((now) => {
        if (!event.ctrlKey && !event.metaKey)
          return { ...now, x: now.x - event.deltaX, y: now.y - event.deltaY };
        const box = frame.getBoundingClientRect();
        const at = { x: event.clientX - box.left, y: event.clientY - box.top };
        const zoom = clamp(now.zoom * Math.exp(-event.deltaY / 200));
        return {
          zoom,
          x: at.x - ((at.x - now.x) / now.zoom) * zoom,
          y: at.y - ((at.y - now.y) / now.zoom) * zoom,
        };
      });
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, []);

  const zoomBy = (factor: number) => {
    const frame = canvas.current;
    if (!frame) return;
    setView((now) => {
      const at = { x: frame.clientWidth / 2, y: frame.clientHeight / 2 };
      const zoom = clamp(now.zoom * factor);
      return {
        zoom,
        x: at.x - ((at.x - now.x) / now.zoom) * zoom,
        y: at.y - ((at.y - now.y) / now.zoom) * zoom,
      };
    });
  };

  const press = (event: ReactPointerEvent) => {
    if ((event.target as Element).closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragTo = (event: ReactPointerEvent) => {
    const from = drag.current;
    if (!from) return;
    setMoved(true);
    setView({
      ...from.view,
      x: from.view.x + event.clientX - from.x,
      y: from.view.y + event.clientY - from.y,
    });
  };

  // What the pointer or the picked asset is connected to stays lit.
  // A hidden card never hears the pointer leave, so check it is still shown.
  const pointed = shown.some((asset) => asset.key === hovered)
    ? hovered
    : undefined;
  const traced = pointed ?? (picked.length === 1 ? picked[0] : undefined);
  const lit = traced
    ? new Set([traced, ...reach([traced], "up"), ...reach([traced], "down")])
    : undefined;
  const matching = filters.find(([id]) => id === filter)?.[3];
  const dim = (key: string) => {
    if (matching) return !matching(assetNow.get(key) as AssetNow);
    return lit ? !lit.has(key) : false;
  };
  const dimGroup = (keys: readonly string[]) => keys.every(dim);
  const dimEnd = (id: string) => {
    const group = made.groups.find((item) => item.name === id);
    return group ? dimGroup(group.keys) : dim(id);
  };

  const toggle = (name: string) => {
    target.current = open.has(name) ? undefined : name;
    setOpened(
      open.has(name)
        ? opened.filter((item) => item !== name)
        : [...opened, name],
    );
  };

  const pick = (key: string, more: boolean) =>
    setPicked(
      more
        ? picked.includes(key)
          ? picked.filter((item) => item !== key)
          : [...picked, key]
        : [key],
    );

  const single =
    picked.length === 1 ? assetNow.get(picked[0] as string) : undefined;

  return (
    <div className="dx-lineage">
      <div className="dx-lineage-bar">
        <label className="ax-search dx-query">
          <Glyph name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Select assets:  fct_invoices+   +churn_model   group:core   kind:dbt"
            aria-label="Asset selection"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear selection query"
              onClick={() => setQuery("")}
            >
              <Glyph name="close" size={13} />
            </button>
          ) : null}
        </label>
        <span className="dx-count">
          {shown.length === scope.length
            ? `${scope.length} assets`
            : `${shown.length} of ${scope.length} assets`}
        </span>
        <span className="ax-grow" />
        {openAll || selection ? null : (
          <Button
            variant="secondary"
            size="small"
            onClick={() =>
              setOpened(open.size === everyGroup.length ? [] : everyGroup)
            }
          >
            <Glyph name="expand" size={13} />
            {open.size === everyGroup.length
              ? "Collapse all groups"
              : "Expand all groups"}
          </Button>
        )}
        {shown.length ? (
          <Button
            size="small"
            onClick={() => setDialog(shown.map((asset) => asset.key))}
            disabled={shown.length > 50}
          >
            <Glyph name="bolt" size={13} />
            {selection
              ? `Materialize selection (${shown.length})`
              : only
                ? "Materialize all"
                : "Materialize"}
          </Button>
        ) : null}
      </div>
      <div className="dx-lineage-filters">
        {filters.map(([id, label, tone, test]) => {
          const found = shown.filter((asset) =>
            test(assetNow.get(asset.key) as AssetNow),
          );
          return found.length ? (
            <button
              type="button"
              key={id}
              aria-pressed={filter === id}
              onClick={() => {
                const next = filter === id ? "" : id;
                setFilter(next);
                // Open the groups that hold a match, so it can be seen.
                if (next && !selection && !openAll)
                  setOpened([
                    ...new Set([
                      ...opened,
                      ...found.map((asset) => asset.group),
                    ]),
                  ]);
              }}
            >
              <Dot tone={tone} />
              {label}
              <b>{found.length}</b>
            </button>
          ) : null;
        })}
      </div>
      <div className="dx-lineage-body" data-panel={Boolean(single)}>
        <div
          className="dx-canvas"
          ref={canvas}
          onPointerDown={press}
          onPointerMove={dragTo}
          onPointerUp={() => {
            drag.current = undefined;
          }}
          data-dsui-scroll
          style={
            {
              "--zoom": view.zoom,
              "--x": `${view.x}px`,
              "--y": `${view.y}px`,
            } as CSSProperties
          }
        >
          <div
            className="dx-world"
            style={{
              width: made.width,
              height: made.height,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            }}
          >
            {made.groups
              .filter((group) => group.open)
              .map((group) => (
                <div
                  key={group.name}
                  className="dx-group"
                  style={{
                    left: group.x,
                    top: group.y,
                    width: group.width,
                    height: group.height,
                  }}
                >
                  {openAll || selection ? (
                    <span className="dx-group-name">{group.name}</span>
                  ) : (
                    <button
                      type="button"
                      className="dx-group-name"
                      aria-expanded="true"
                      title={`Collapse ${group.name}`}
                      onClick={() => toggle(group.name)}
                    >
                      <Glyph name="down" size={13} />
                      {group.name}
                      <small>{group.keys.length}</small>
                    </button>
                  )}
                </div>
              ))}
            <svg width={made.width} height={made.height} aria-hidden="true">
              {made.edges.map((edge) => (
                <path
                  key={`${edge.from}>${edge.to}`}
                  d={curve(edge.fromBox, edge.toBox)}
                  data-dim={dimEnd(edge.from) || dimEnd(edge.to)}
                  data-lit={
                    Boolean(lit) &&
                    !matching &&
                    !dimEnd(edge.from) &&
                    !dimEnd(edge.to)
                  }
                />
              ))}
            </svg>
            {made.groups
              .filter((group) => !group.open)
              .map((group) => (
                <button
                  type="button"
                  key={group.name}
                  className="dx-card"
                  aria-expanded="false"
                  aria-label={`${group.name}, ${group.keys.length} assets, collapsed`}
                  data-dim={dimGroup(group.keys)}
                  style={{ left: group.x, top: group.y, ...CARD }}
                  onClick={() => toggle(group.name)}
                >
                  <span className="dx-node-name">
                    <KindMark
                      kind={assetByKey.get(group.keys[0] ?? "")?.kinds[0] ?? ""}
                    />
                    <strong>{group.name}</strong>
                    <Glyph name="right" size={14} />
                  </span>
                  <small>{group.keys.length} assets</small>
                  <GroupSummary keys={group.keys} />
                </button>
              ))}
            {made.nodes.map((node) => {
              const item = assetNow.get(node.key) as AssetNow;
              return (
                <button
                  type="button"
                  key={node.key}
                  className="dx-node"
                  data-state={assetStates[item.state][1]}
                  data-dim={dim(node.key)}
                  aria-pressed={picked.includes(node.key)}
                  aria-label={`${item.def.name}, ${assetStates[item.state][0]}`}
                  style={{ left: node.x, top: node.y, ...NODE }}
                  onMouseEnter={() => setHovered(node.key)}
                  onMouseLeave={() => setHovered(undefined)}
                  onClick={(event) =>
                    pick(
                      node.key,
                      event.shiftKey || event.metaKey || event.ctrlKey,
                    )
                  }
                  onDoubleClick={() => go(assetPath(node.key))}
                >
                  <AssetCard item={item} />
                </button>
              );
            })}
          </div>
          {shown.length ? null : (
            <div className="dx-canvas-empty">
              <strong>No asset matches “{query}”</strong>
              <p>
                Type part of a name, or use group:, kind:, owner: or
                code_location:.
              </p>
              <Button variant="secondary" onClick={() => setQuery("")}>
                Show all assets
              </Button>
            </div>
          )}
          <div className="dx-zoom">
            <IconButton
              icon="plus"
              label="Zoom in"
              onClick={() => zoomBy(1.25)}
            />
            <span>{Math.round(view.zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zoom out"
              onClick={() => zoomBy(0.8)}
            >
              −
            </Button>
            <IconButton
              icon="expand"
              label="Fit the whole graph"
              onClick={() => fit()}
            />
          </div>
          {picked.length > 1 ? (
            <div className="dx-picked" role="status">
              <strong>{picked.length} assets selected</strong>
              <Button size="small" onClick={() => setDialog(picked)}>
                <Glyph name="bolt" size={13} />
                Materialize selected
              </Button>
              <Button
                size="small"
                variant="ghost"
                onClick={() => setPicked([])}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>
        {single ? (
          <NodePanel
            item={single}
            onClose={() => setPicked([])}
            onPick={(key) => {
              const group = assetByKey.get(key)?.group ?? "";
              if (!open.has(group)) {
                setOpened([...opened, group]);
              }
              setPicked([key]);
            }}
            onSelect={(next) => {
              setQuery(next);
              setFilter("");
            }}
            onMaterialize={() => setDialog([single.def.key])}
          />
        ) : null}
      </div>
      {dialog ? (
        <MaterializeDialog keys={dialog} onClose={() => setDialog(undefined)} />
      ) : null}
    </div>
  );
}

function Neighbours({
  title,
  keys,
  onPick,
}: {
  title: string;
  keys: readonly string[];
  onPick: (key: string) => void;
}) {
  return (
    <section>
      <h3>
        {title} <small>{keys.length}</small>
      </h3>
      {keys.slice(0, 8).map((key) => {
        const item = assetNow.get(key) as AssetNow;
        return (
          <button type="button" key={key} onClick={() => onPick(key)}>
            <Dot
              tone={assetStates[item.state][1]}
              label={assetStates[item.state][0]}
            />
            <span title={key}>{item.def.name}</span>
          </button>
        );
      })}
      {keys.length > 8 ? <small>and {keys.length - 8} more</small> : null}
      {keys.length ? null : <small>None</small>}
    </section>
  );
}

function NodePanel({
  item,
  onClose,
  onPick,
  onSelect,
  onMaterialize,
}: {
  item: AssetNow;
  onClose: () => void;
  onPick: (key: string) => void;
  onSelect: (query: string) => void;
  onMaterialize: () => void;
}) {
  const { def, latest } = item;
  const partitions = partitionsOf(def.key);
  const [label, tone] = assetStates[item.state];
  const run = item.failedRun ?? item.runningRun;
  return (
    <aside className="dx-node-panel" aria-label={`Asset ${def.name}`}>
      <header>
        <div>
          <strong title={def.key}>{def.name}</strong>
          <small>
            {def.group} · {def.location}
          </small>
        </div>
        <IconButton icon="close" label="Close panel" onClick={onClose} />
      </header>
      <Pill tone={tone} label={label} />
      <Kinds kinds={def.kinds} />
      <p>{def.description}</p>
      {item.failedRun?.failure ? (
        <div className="dx-error-line">
          <code>{item.failedRun.failure.line}</code>
        </div>
      ) : null}
      {item.staleCause ? (
        <p className="ax-warn">Stale because {item.staleCause}.</p>
      ) : null}
      <div className="dx-panel-actions">
        <Button size="small" onClick={onMaterialize}>
          <Glyph name="bolt" size={13} />
          Materialize
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => go(assetPath(def.key))}
        >
          Open asset
        </Button>
        {run ? (
          <Button
            size="small"
            variant="secondary"
            onClick={() => go(runPath(run.id))}
          >
            {item.failedRun ? "View failed run" : "View run"}
          </Button>
        ) : null}
      </div>
      <dl>
        <dt>Last materialized</dt>
        <dd>{latest ? stamp(latest.at) : "Never"}</dd>
        <dt>Rows</dt>
        <dd>{latest ? latest.rows.toLocaleString("en") : "—"}</dd>
        <dt>Checks</dt>
        <dd>
          <CheckCount item={item} />
        </dd>
        {partitions ? (
          <>
            <dt>Partitions</dt>
            <dd>
              <PartitionBar partitions={partitions} />
            </dd>
          </>
        ) : null}
      </dl>
      <div className="dx-focus">
        <span>Show only</span>
        <button type="button" onClick={() => onSelect(`+${def.name}`)}>
          Upstream
        </button>
        <button type="button" onClick={() => onSelect(`${def.name}+`)}>
          Downstream
        </button>
        <button type="button" onClick={() => onSelect(`+${def.name}+`)}>
          Both
        </button>
      </div>
      <Neighbours title="Depends on" keys={def.deps} onPick={onPick} />
      <Neighbours
        title="Used by"
        keys={downstream.get(def.key) ?? []}
        onPick={onPick}
      />
    </aside>
  );
}
