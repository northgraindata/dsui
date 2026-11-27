/* The asset catalog. */
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import {
  Choice,
  Empty,
  Search,
  Segments,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "../shared/list";
import { go, IconButton, Panel } from "../shared/ui";
import {
  type AssetNow,
  assetStates,
  catalog,
  failing,
  partitionsOf,
} from "./catalog";
import { MaterializeDialog } from "./materialize";
import {
  assetPath,
  CheckCount,
  Dot,
  Header,
  KindMark,
  Kinds,
  kindLabel,
  PartitionBar,
} from "./parts";
import { stamp } from "./time";

const views = {
  all: () => true,
  failed: (item: AssetNow) => item.state === "failed",
  checks: (item: AssetNow) => failing(item).length > 0,
  stale: (item: AssetNow) => item.state === "stale",
  never: (item: AssetNow) => item.state === "never",
  materializing: (item: AssetNow) => item.state === "materializing",
  fresh: (item: AssetNow) => item.state === "fresh",
};
type ViewName = keyof typeof views;

export function Assets({ query }: { query: URLSearchParams }) {
  const wanted = query.get("state") as ViewName | null;
  const [filters, setFilters] = useRemembered(`dx:assets:${wanted ?? ""}`, {
    state: (wanted && wanted in views ? wanted : "all") as ViewName,
    search: "",
    group: query.get("group") ?? "",
    kind: "",
    location: "",
    owner: "",
  });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<string[]>();
  const matching = catalog.filter(
    ({ def }) =>
      def.key.includes(filters.search.toLowerCase().trim()) &&
      (!filters.group || def.group === filters.group) &&
      (!filters.kind || def.kinds.includes(filters.kind)) &&
      (!filters.location || def.location === filters.location) &&
      (!filters.owner || def.owner === filters.owner),
  );
  const rows = matching
    .filter(views[filters.state])
    .sort((a, b) => a.def.key.localeCompare(b.def.key));
  const { visible, pager } = usePages(
    "dx:assets",
    rows,
    JSON.stringify(filters),
  );
  const change = (next: Partial<typeof filters>) => {
    setSelected(new Set());
    setFilters({ ...filters, ...next });
  };
  const segment = (value: ViewName, label: string, tone?: string) => ({
    value,
    label,
    tone,
    count: matching.filter(views[value]).length,
  });
  const allChosen =
    visible.length > 0 && visible.every((item) => selected.has(item.def.key));
  const kinds = unique(catalog.flatMap((item) => item.def.kinds));
  return (
    <>
      <Header art="assets" title="Assets" />
      <Toolbar>
        <Segments
          label="State"
          value={filters.state}
          onChange={(state) => change({ state })}
          options={[
            segment("all", "All"),
            segment("failed", "Failed", "failed"),
            segment("checks", "Failing checks", "up_for_retry"),
            segment("stale", "Stale", "up_for_retry"),
            segment("never", "Never materialized", "none"),
            segment("materializing", "Materializing", "running"),
            segment("fresh", "Materialized", "success"),
          ]}
        />
      </Toolbar>
      <Toolbar>
        {selected.size ? (
          <div className="dx-selection">
            <IconButton
              icon="close"
              label="Clear selection"
              onClick={() => setSelected(new Set())}
            />
            <strong>{selected.size} selected</strong>
            <span className="ax-grow" />
            <Button size="small" onClick={() => setDialog([...selected])}>
              <Glyph name="bolt" size={13} />
              Materialize selected
            </Button>
          </div>
        ) : (
          <>
            <Search
              label="Search by asset key"
              value={filters.search}
              onChange={(search) => change({ search })}
            />
            <Choice
              all="All groups"
              value={filters.group}
              options={unique(catalog.map((item) => item.def.group))}
              onChange={(group) => change({ group })}
            />
            <Choice
              all="All kinds"
              value={filters.kind}
              options={kinds}
              rich={{
                allIcon: <Glyph name="plug" />,
                options: kinds.map((kind) => ({
                  value: kind,
                  label: kindLabel(kind),
                  icon: <KindMark kind={kind} />,
                })),
              }}
              onChange={(kind) => change({ kind })}
            />
            <Choice
              all="All code locations"
              value={filters.location}
              options={unique(catalog.map((item) => item.def.location))}
              onChange={(location) => change({ location })}
            />
            <Choice
              all="All owners"
              value={filters.owner}
              options={unique(catalog.map((item) => item.def.owner))}
              onChange={(owner) => change({ owner })}
            />
          </>
        )}
      </Toolbar>
      <Panel flush>
        <div className="ax-table dx-asset-table" data-dsui-scroll>
          <div className="ax-thead">
            <input
              type="checkbox"
              aria-label="Select all assets on this page"
              checked={allChosen}
              onChange={() =>
                setSelected(
                  allChosen
                    ? new Set()
                    : new Set(visible.map((item) => item.def.key)),
                )
              }
            />
            <span />
            <span>Asset</span>
            <span>Kinds</span>
            <span>Last materialized</span>
            <span>Checks</span>
            <span>Partitions</span>
            <span />
          </div>
          {visible.map((item) => {
            const partitions = partitionsOf(item.def.key);
            const [label, tone] = assetStates[item.state];
            return (
              // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
              <div
                className="ax-tr"
                role="link"
                tabIndex={0}
                key={item.def.key}
                aria-label={`${item.def.name}, ${label}`}
                onClick={() => go(assetPath(item.def.key))}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  event.target === event.currentTarget &&
                  go(assetPath(item.def.key))
                }
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${item.def.name}`}
                  checked={selected.has(item.def.key)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => {
                    const next = new Set(selected);
                    if (!next.delete(item.def.key)) next.add(item.def.key);
                    setSelected(next);
                  }}
                />
                <Dot tone={tone} label={label} />
                <span className="dx-two">
                  <strong title={item.def.key}>{item.def.name}</strong>
                  <small>{item.def.group}</small>
                </span>
                <Kinds kinds={item.def.kinds} />
                <span className="dx-two">
                  <span>{item.latest ? stamp(item.latest.at) : "Never"}</span>
                  <small
                    data-stale={Boolean(
                      item.staleCause ||
                        item.failedRun ||
                        (item.freshness && !item.freshness.passing),
                    )}
                    title={item.staleCause}
                  >
                    {item.state === "failed"
                      ? "Latest attempt failed"
                      : item.state === "materializing"
                        ? "Materializing now"
                        : item.staleCause
                          ? `Stale: ${item.staleCause}`
                          : item.freshness && !item.freshness.passing
                            ? "Freshness overdue"
                            : ""}
                  </small>
                </span>
                <CheckCount item={item} />
                {partitions ? (
                  <PartitionBar partitions={partitions} />
                ) : (
                  <span className="ax-muted">—</span>
                )}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
                <span
                  className="ax-row-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <IconButton
                    icon="bolt"
                    label={`Materialize ${item.def.name}`}
                    onClick={() => setDialog([item.def.key])}
                  />
                  <IconButton
                    icon="arrow"
                    label={`Show ${item.def.name} in lineage`}
                    onClick={() => go(`/lineage?focus=${item.def.key}`)}
                  />
                </span>
              </div>
            );
          })}
        </div>
        {rows.length ? (
          pager
        ) : (
          <Empty
            filtered
            onClear={() =>
              change({
                state: "all",
                search: "",
                group: "",
                kind: "",
                location: "",
                owner: "",
              })
            }
          />
        )}
      </Panel>
      {dialog ? (
        <MaterializeDialog keys={dialog} onClose={() => setDialog(undefined)} />
      ) : null}
    </>
  );
}
