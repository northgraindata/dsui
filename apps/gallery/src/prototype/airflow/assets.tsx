import { type Asset, assets, dags, eventsOf, stamp } from "./data";
import { Art, Glyph, type GlyphName } from "./icons";
import {
  Choice,
  Empty,
  Search,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "./list";
import { Dot, go, Header, Panel } from "./parts";

/** Airflow stores only a URI, so its scheme is what tells the system. */
export const assetGlyph = (uri: string): GlyphName =>
  uri.startsWith("s3:") ? "bucket" : uri.startsWith("http") ? "http" : "sql";

function DagNode({ id }: { id: string }) {
  const dag = dags.find((item) => item.id === id);
  const state = dag?.paused ? "none" : (dag?.runs.at(-1) ?? "none");
  return (
    <button
      type="button"
      className="ax-lineage-dag"
      onClick={() => go(`/dags/${id}`)}
    >
      <Art name="dags" size={26} />
      <span>
        <strong>{id}</strong>
        <small>
          <Dot state={state} />
          {dag?.paused ? "Paused" : `Latest run ${state}`}
        </small>
      </span>
    </button>
  );
}

export function AssetRef({ asset }: { asset: Asset }) {
  return (
    <button
      type="button"
      className="ax-ref"
      onClick={() => go(`/assets/${asset.id}`)}
    >
      <Glyph name={assetGlyph(asset.uri)} size={16} />
      <span>
        <strong>{asset.name}</strong>
        <small>
          {asset.lastEvent
            ? `last event ${stamp(asset.lastEvent)}`
            : "no events yet"}
        </small>
      </span>
    </button>
  );
}

export function Assets() {
  const [filters, setFilters] = useRemembered("assets:filters", {
    search: "",
    group: "",
  });
  const needle = filters.search.trim().toLowerCase();
  const rows = assets
    .filter(
      (asset) =>
        (!needle ||
          asset.name.includes(needle) ||
          asset.uri.includes(needle)) &&
        (!filters.group || asset.group === filters.group),
    )
    .sort(
      (a, b) => (b.lastEvent?.getTime() ?? 0) - (a.lastEvent?.getTime() ?? 0),
    );
  const { visible, pager } = usePages("assets", rows, JSON.stringify(filters));
  return (
    <>
      <Header art="assets" title="Assets" />
      <Toolbar>
        <Search
          label="Search by name or URI"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
        <Choice
          all="All groups"
          value={filters.group}
          options={unique(assets.map((asset) => asset.group))}
          onChange={(group) => setFilters({ ...filters, group })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table ax-asset-table" data-dsui-scroll>
          <div className="ax-thead">
            <span>Asset</span>
            <span>Group</span>
            <span>Written by</span>
            <span>Schedules</span>
            <span>Last event</span>
          </div>
          {visible.map((asset) => (
            <button
              type="button"
              className="ax-tr"
              key={asset.id}
              onClick={() => go(`/assets/${asset.id}`)}
            >
              <span className="ax-name ax-with-glyph">
                <Glyph name={assetGlyph(asset.uri)} size={17} />
                <span>
                  <strong>{asset.name}</strong>
                  <small>{asset.uri}</small>
                </span>
              </span>
              <span>{asset.group}</span>
              <span>{asset.producers.join(", ") || "—"}</span>
              <span>
                {asset.scheduled.length
                  ? `${asset.scheduled.length} DAG${asset.scheduled.length > 1 ? "s" : ""}`
                  : "—"}
              </span>
              <span>
                {asset.lastEvent ? stamp(asset.lastEvent) : "No events yet"}
              </span>
            </button>
          ))}
        </div>
        {rows.length ? null : (
          <Empty
            filtered
            onClear={() => setFilters({ search: "", group: "" })}
          />
        )}
        {pager}
      </Panel>
    </>
  );
}

export function AssetPage({ asset }: { asset: Asset }) {
  const events = eventsOf(asset);
  const { visible, pager } = usePages(`asset:${asset.id}`, events, "");
  const nodes = (ids: string[], none: string) =>
    ids.length ? (
      ids.map((id) => <DagNode key={id} id={id} />)
    ) : (
      <small className="ax-muted">{none}</small>
    );
  return (
    <>
      <Header
        art="assets"
        crumbs={[["Assets", "/assets"]]}
        title={asset.name}
        subtitle={asset.uri}
        meta={
          <>
            <span className="ax-chip">
              <Glyph name="clock" size={13} />
              {asset.lastEvent
                ? `Last event ${stamp(asset.lastEvent)}`
                : "No events yet"}
            </span>
            <span className="ax-tag">#{asset.group}</span>
          </>
        }
      />
      <Panel title="Lineage">
        <div className="ax-lineage-line ax-lineage-solo">
          <div className="ax-stack">
            {nodes(asset.producers, "No task writes it")}
          </div>
          <span className="ax-wire" aria-hidden="true" />
          <div className="ax-asset">
            <Glyph name={assetGlyph(asset.uri)} size={18} />
            <span>
              <strong>{asset.name}</strong>
              <small>this asset</small>
            </span>
          </div>
          <span className="ax-wire" aria-hidden="true" />
          <div className="ax-stack">
            {nodes(asset.scheduled, "No DAG waits for it")}
          </div>
        </div>
      </Panel>
      <Panel title="Events" flush>
        <div className="ax-table ax-event-table" data-dsui-scroll>
          <div className="ax-thead">
            <span>Time</span>
            <span>Source DAG</span>
            <span>Source task</span>
            <span>Runs triggered</span>
          </div>
          {visible.map((event) => (
            <button
              type="button"
              className="ax-tr"
              key={event.at.getTime()}
              onClick={() => go(`/dags/${event.sourceDag}`)}
            >
              <span>{stamp(event.at)}</span>
              <strong>{event.sourceDag}</strong>
              <span>{event.sourceTask}</span>
              <span>{event.triggered}</span>
            </button>
          ))}
        </div>
        {events.length ? (
          pager
        ) : (
          <p className="ax-empty">No task has updated this asset yet.</p>
        )}
      </Panel>
    </>
  );
}
