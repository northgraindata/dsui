/* Runs and backfills. */
import { useState } from "react";
import {
  Choice,
  Empty,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "../shared/list";
import { Act, go, Panel, Tabs } from "../shared/ui";
import { partitionsOf } from "./catalog";
import { assetByKey } from "./graph";
import { type Backfill, backfillRunsOf, backfills } from "./ops";
import { assetPath, BackfillPill, Dot, Header } from "./parts";
import { RunTable } from "./run-table";
import { runs } from "./runs";
import { backfillStates } from "./states";
import { NOW, stamp } from "./time";

const name = (key: string) => assetByKey.get(key)?.name ?? key;

function Progress({ item }: { item: Backfill }) {
  const waiting =
    item.total - item.done - item.failed - item.running - item.canceled;
  const parts: [string, string, number][] = [
    ["success", "succeeded", item.done],
    ["failed", "failed", item.failed],
    ["running", "in progress", item.running],
    ["removed", "canceled", item.canceled],
    ["none", "waiting", waiting],
  ];
  const text = parts
    .filter(([, , count]) => count)
    .map(([, label, count]) => `${count} ${label}`)
    .join(", ");
  return (
    <span className="dx-progress">
      <span
        className="dx-progress-bar"
        role="img"
        aria-label={text}
        title={text}
      >
        {parts.map(([tone, , count]) =>
          count ? (
            <i
              key={tone}
              data-state={tone}
              style={{ flexGrow: Math.max(count, item.total * 0.02) }}
            />
          ) : null,
        )}
      </span>
      <small>
        {item.done} of {item.total}
        {item.failed ? ` · ${item.failed} failed` : ""}
      </small>
    </span>
  );
}

function BackfillActions({
  item,
  iconOnly,
}: {
  item: Backfill;
  iconOnly?: boolean;
}) {
  return (
    <>
      {item.status === "REQUESTED" ? (
        <Act
          iconOnly={iconOnly}
          icon="stop"
          label="Cancel backfill"
          title={`Cancel backfill ${item.id}?`}
          description="No more runs are launched, and runs in progress are terminated. Materialized partitions stay."
        />
      ) : null}
      {item.failed ? (
        <Act
          iconOnly={iconOnly}
          icon="retry"
          label="Re-execute failed"
          title={`Re-execute ${item.failed} failed partitions?`}
          description="A new backfill is launched for the failed partitions only."
        />
      ) : null}
      {item.status === "CANCELED" ? (
        <Act
          iconOnly={iconOnly}
          icon="play"
          label="Resume backfill"
          title={`Resume backfill ${item.id}?`}
          description={`${item.canceled} partitions are still to be materialized.`}
        />
      ) : null}
    </>
  );
}

function Backfills() {
  const [filters, setFilters] = useRemembered("dx:backfills", {
    status: "",
    period: "",
  });
  const rows = backfills.filter(
    (item) =>
      (!filters.status || item.status === filters.status) &&
      (!filters.period ||
        NOW.getTime() - item.created.getTime() <=
          Number(filters.period) * 86_400_000),
  );
  const { visible, pager } = usePages(
    "dx:backfills",
    rows,
    JSON.stringify(filters),
  );
  return (
    <>
      <Toolbar>
        <Choice
          all="Any status"
          value={filters.status}
          options={unique(backfills.map((item) => item.status))}
          names={Object.fromEntries(
            Object.entries(backfillStates).map(([key, [label]]) => [
              key,
              label,
            ]),
          )}
          onChange={(status) => setFilters({ ...filters, status })}
        />
        <Choice
          all="Any time"
          value={filters.period}
          options={["1", "7", "30"]}
          names={{
            "1": "Last 24 hours",
            "7": "Last 7 days",
            "30": "Last 30 days",
          }}
          onChange={(period) => setFilters({ ...filters, period })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table dx-backfill-table" data-dsui-scroll>
          <div className="ax-thead">
            <span />
            <span>Backfill</span>
            <span>Partitions</span>
            <span>Progress</span>
            <span>Created</span>
            <span />
          </div>
          {visible.map((item) => (
            // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
            <div
              className="ax-tr"
              role="link"
              tabIndex={0}
              key={item.id}
              onClick={() => go(`/backfills/${item.id}`)}
              onKeyDown={(event) =>
                event.key === "Enter" &&
                event.target === event.currentTarget &&
                go(`/backfills/${item.id}`)
              }
            >
              <Dot
                tone={backfillStates[item.status][1]}
                label={backfillStates[item.status][0]}
              />
              <span className="dx-two">
                <strong>{name(item.asset)}</strong>
                <small>
                  {item.id} · {backfillStates[item.status][0]}
                </small>
              </span>
              <span className="dx-two">
                <span>{item.total}</span>
                <small>
                  {item.from} to {item.to}
                </small>
              </span>
              <Progress item={item} />
              <span className="dx-two">
                <span>{stamp(item.created)}</span>
                <small>{item.by}</small>
              </span>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
              <span
                className="ax-row-actions"
                onClick={(event) => event.stopPropagation()}
              >
                <BackfillActions item={item} iconOnly />
              </span>
            </div>
          ))}
        </div>
        {rows.length ? (
          pager
        ) : (
          <Empty
            filtered
            onClear={() => setFilters({ status: "", period: "" })}
          />
        )}
      </Panel>
    </>
  );
}

export function Runs({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useState(
    query.get("tab") === "Backfills" ? "Backfills" : "Runs",
  );
  const state = query.get("state");
  return (
    <>
      <Header art="runs" title="Runs" />
      <Tabs tabs={["Runs", "Backfills"]} value={tab} onChange={setTab} />
      {tab === "Runs" ? (
        <RunTable
          id="all"
          runs={runs}
          initial={state === "failed" || state === "running" ? state : "all"}
        />
      ) : (
        <Backfills />
      )}
    </>
  );
}

export function BackfillPage({ item }: { item: Backfill }) {
  const partitions = partitionsOf(item.asset);
  const keys =
    partitions?.keys.filter((key) => key >= item.from && key <= item.to) ?? [];
  const own = backfillRunsOf(item.id);
  const toneOf = (key: string, index: number) => {
    const run = own.find((entry) => entry.partition === key);
    if (run?.status === "FAILURE") return "failed";
    if (run && run.status !== "SUCCESS")
      return run.status === "QUEUED" ? "queued" : "running";
    if (run || index < item.done) return "success";
    return item.status === "CANCELED" ? "removed" : "none";
  };
  return (
    <>
      <Header
        art="partitions"
        title={<code className="dx-title-code">{item.id}</code>}
        crumbs={[
          ["Runs", "/runs"],
          ["Backfills", "/runs?tab=Backfills"],
        ]}
        meta={
          <>
            <BackfillPill status={item.status} />
            <button
              type="button"
              className="ax-link"
              onClick={() => go(`${assetPath(item.asset)}?tab=Partitions`)}
            >
              {name(item.asset)}
            </button>
            <span>
              {item.from} to {item.to}
            </span>
            <span>
              Launched {stamp(item.created)} by {item.by}
            </span>
          </>
        }
        actions={<BackfillActions item={item} />}
      />
      <Panel title="Partitions" aside={<Progress item={item} />}>
        <div className="dx-calendar dx-backfill-cells" data-monthly="false">
          <div>
            <div>
              {keys.slice(0, 400).map((key, index) => {
                const tone = toneOf(key, index);
                const run = own.find((entry) => entry.partition === key);
                return run ? (
                  <button
                    type="button"
                    key={key}
                    data-state={tone}
                    title={`${key}: open run ${run.id}`}
                    aria-label={`${key}, ${tone}`}
                    onClick={() => go(`/runs/${run.id}`)}
                  />
                ) : (
                  <i key={key} data-state={tone} title={key} />
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
      {own.length ? (
        <RunTable id={`backfill:${item.id}`} runs={own} />
      ) : (
        <Panel>
          <p className="ax-muted">
            The runs of this backfill are older than the run history kept here.
          </p>
        </Panel>
      )}
    </>
  );
}
