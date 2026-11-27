/* One asset: its state, partitions, history, checks and place in the graph. */
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Segments } from "../shared/list";
import { useTip } from "../shared/tip";
import { Act, go, Panel, Tabs } from "../shared/ui";
import {
  type AssetNow,
  assetStates,
  type Materialization,
  materializationsOf,
  partitionsOf,
} from "./catalog";
import { downstream, reach } from "./graph";
import { jobsOf } from "./jobs";
import { Lineage } from "./lineage";
import { MaterializeDialog } from "./materialize";
import { instigators } from "./ops";
import { PartitionMap } from "./partitions";
import {
  assetPath,
  CheckCount,
  Dot,
  Header,
  Kinds,
  PartitionBar,
  Pill,
  runPath,
} from "./parts";
import { checkStates } from "./states";
import { hms, stamp, stampSeconds } from "./time";

const plots = {
  rows: [
    "Rows",
    (item: Materialization) => item.rows,
    (value: number) => value.toLocaleString("en"),
  ],
  seconds: [
    "Step duration",
    (item: Materialization) => item.seconds,
    (value: number) => hms(value),
  ],
} as const;

/** A numeric value over the latest materializations. */
function Plot({ history }: { history: Materialization[] }) {
  const [name, setName] = useState<keyof typeof plots>("rows");
  const tip = useTip();
  const [, read, show] = plots[name];
  const shown = history.slice(0, 30).reverse();
  const most = Math.max(1, ...shown.map(read));
  return (
    <Panel
      title={`Last ${shown.length} materializations`}
      aside={
        <Segments
          label="Value"
          value={name}
          onChange={setName}
          options={[
            { value: "rows", label: "Rows" },
            { value: "seconds", label: "Step duration" },
          ]}
        />
      }
    >
      <div className="dx-plot">
        <div className="dx-plot-scale" aria-hidden="true">
          <small>{show(most)}</small>
          <small>{show(Math.round(most / 2))}</small>
          <small>0</small>
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: only hides the tooltip */}
        <div className="dx-plot-bars" onMouseLeave={tip.hide}>
          {shown.map((item) => (
            <button
              type="button"
              key={`${item.run.id}${item.partition}`}
              aria-label={`${stampSeconds(item.at)}: ${show(read(item))}`}
              onClick={() => go(runPath(item.run.id))}
              onMouseEnter={(event) =>
                tip.show(
                  event,
                  <>
                    <strong>{show(read(item))}</strong>
                    <span>{stampSeconds(item.at)}</span>
                    <span>Run {item.run.id}</span>
                  </>,
                )
              }
            >
              <i
                style={{ height: `${Math.max(2, (read(item) / most) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="ax-axis dx-plot-axis">
        <span>{shown[0] ? stamp(shown[0].at) : ""}</span>
        <span>
          {shown.at(-1) ? stamp((shown.at(-1) as Materialization).at) : ""}
        </span>
      </div>
      {tip.node}
    </Panel>
  );
}

function Overview({
  item,
  onTab,
}: {
  item: AssetNow;
  onTab: (tab: string) => void;
}) {
  const history = materializationsOf(item.def.key);
  const { latest } = item;
  const partitions = partitionsOf(item.def.key);
  const [label, tone] = assetStates[item.state];
  return (
    <>
      {item.failedRun?.failure ? (
        <section className="dx-run-failure">
          <Glyph name="alert" size={18} />
          <div>
            <strong>
              The latest attempt to materialize failed{" "}
              {stamp(item.failedRun.created)}
            </strong>
            <code>{item.failedRun.failure.line}</code>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => go(runPath(item.failedRun?.id ?? ""))}
          >
            Open run
          </Button>
        </section>
      ) : null}
      <div className="dx-facts">
        <article>
          <small>Status</small>
          <Pill tone={tone} label={label} />
          <p>
            {item.staleCause
              ? `Because ${item.staleCause}.`
              : latest
                ? `Last materialized ${stamp(latest.at)}.`
                : "This asset has not been materialized yet."}
          </p>
        </article>
        {item.freshness ? (
          <article>
            <small>Freshness policy</small>
            <Pill
              tone={item.freshness.passing ? "success" : "up_for_retry"}
              label={item.freshness.passing ? "Passing" : "Overdue"}
            />
            <p>
              Must be rebuilt every{" "}
              {item.freshness.window >= 120
                ? `${item.freshness.window / 60} hours`
                : `${item.freshness.window} minutes`}
              .
            </p>
          </article>
        ) : null}
        <article>
          <small>Asset checks</small>
          <CheckCount item={item} />
          <p>
            {item.checks.length ? (
              <button
                type="button"
                className="ax-link"
                onClick={() => onTab("Checks")}
              >
                {item.checks.length} defined
              </button>
            ) : (
              "No checks are defined."
            )}
          </p>
        </article>
        {partitions ? (
          <article>
            <small>Partitions</small>
            <PartitionBar partitions={partitions} />
            <p>
              <button
                type="button"
                className="ax-link"
                onClick={() => onTab("Partitions")}
              >
                {partitions.failed.size + partitions.missing.size} missing or
                failed
              </button>
            </p>
          </article>
        ) : null}
      </div>
      {history.length > 1 ? <Plot history={history} /> : null}
      <div className="ax-split">
        <Panel title="Latest metadata">
          {latest ? (
            <dl className="dx-dl">
              <div>
                <dt>dagster/row_count</dt>
                <dd>{latest.rows.toLocaleString("en")}</dd>
              </div>
              <div>
                <dt>dagster/table_name</dt>
                <dd>
                  <code>
                    ANALYTICS.{item.def.group.toUpperCase()}.
                    {item.def.name.toUpperCase()}
                  </code>
                </dd>
              </div>
              {item.def.kinds.includes("dbt") ? (
                <div>
                  <dt>dbt/materialization</dt>
                  <dd>table</dd>
                </div>
              ) : null}
              <div>
                <dt>Run</dt>
                <dd>
                  <button
                    type="button"
                    className="ax-link"
                    onClick={() => go(runPath(latest.run.id))}
                  >
                    {latest.run.id}
                  </button>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="ax-muted">
              Metadata appears after the first materialization.
            </p>
          )}
        </Panel>
        <Panel title="Definition">
          <dl className="dx-dl">
            <div>
              <dt>Key</dt>
              <dd>
                <code>{item.def.key}</code>
              </dd>
            </div>
            <div>
              <dt>Group</dt>
              <dd>
                <button
                  type="button"
                  className="ax-link"
                  onClick={() => go(`/assets?group=${item.def.group}`)}
                >
                  {item.def.group}
                </button>
              </dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>team:{item.def.owner}</dd>
            </div>
            <div>
              <dt>Code location</dt>
              <dd>{item.def.location}</dd>
            </div>
            <div>
              <dt>Jobs</dt>
              <dd className="dx-links">
                {jobsOf(item.def).map((job) => (
                  <button
                    type="button"
                    className="ax-link"
                    key={job.name}
                    onClick={() => go(`/jobs/${job.name}`)}
                  >
                    {job.name}
                  </button>
                ))}
              </dd>
            </div>
            <div>
              <dt>Automation</dt>
              <dd className="dx-links">
                {instigators
                  .filter((other) =>
                    jobsOf(item.def).some((job) => job.name === other.job),
                  )
                  .map((other) => (
                    <button
                      type="button"
                      className="ax-link"
                      key={other.name}
                      onClick={() => go(`/automation/${other.name}`)}
                    >
                      {other.name}
                    </button>
                  ))}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </>
  );
}

function Events({ item }: { item: AssetNow }) {
  const history = materializationsOf(item.def.key);
  const failed = item.failedRun;
  return (
    <Panel flush>
      <div className="ax-table dx-history-table" data-dsui-scroll>
        <div className="ax-thead">
          <span />
          <span>When</span>
          <span>Event</span>
          <span>Partition</span>
          <span>Rows</span>
          <span>Run</span>
        </div>
        {failed ? (
          <button
            type="button"
            className="ax-tr"
            onClick={() => go(runPath(failed.id))}
          >
            <Dot tone="failed" label="Failure" />
            <span>{stampSeconds(failed.created)}</span>
            <span>Failed to materialize</span>
            <span>{failed.partition ?? "—"}</span>
            <span>—</span>
            <code>{failed.id}</code>
          </button>
        ) : null}
        {history.map((event) => (
          <button
            type="button"
            className="ax-tr"
            key={`${event.run.id}${event.partition}`}
            onClick={() => go(runPath(event.run.id))}
          >
            <Dot tone="success" label="Materialization" />
            <span>{stampSeconds(event.at)}</span>
            <span>Materialization</span>
            <span>{event.partition ?? "—"}</span>
            <span>{event.rows.toLocaleString("en")}</span>
            <code>{event.run.id}</code>
          </button>
        ))}
      </div>
      {history.length || failed ? null : (
        <p className="ax-empty">No materialization yet.</p>
      )}
    </Panel>
  );
}

function Checks({ item }: { item: AssetNow }) {
  return (
    <div className="dx-check-list">
      {item.checks.map((check) => {
        const [label, tone] = checkStates[check.status];
        return (
          <section key={check.name} data-failed={check.status === "FAILED"}>
            <header>
              <Dot tone={tone} />
              <div>
                <strong>{check.name}</strong>
                <small>{check.description}</small>
              </div>
              <span className="ax-chip-tag">
                {check.severity === "ERROR" ? "Error" : "Warning"}
              </span>
              {check.blocking ? (
                <span className="ax-chip-tag">Blocking</span>
              ) : null}
              <Pill tone={tone} label={label} />
              <Act
                iconOnly
                icon="play"
                label="Run check"
                title={`Run ${check.name}?`}
                description="Only the check runs. The asset is not materialized."
              />
            </header>
            {check.detail ? <code>{check.detail}</code> : null}
            <p>
              Evaluated {stamp(check.at)}
              <span aria-hidden="true">
                {materializationsOf(item.def.key)
                  .slice(0, 20)
                  .reverse()
                  .map((event, index, all) => (
                    <i
                      key={`${event.run.id}${event.partition}`}
                      data-state={
                        check.status === "FAILED" && index > all.length - 3
                          ? "failed"
                          : "success"
                      }
                    />
                  ))}
              </span>
            </p>
          </section>
        );
      })}
      {item.checks.length ? null : (
        <p className="ax-empty">No asset checks are defined for this asset.</p>
      )}
    </div>
  );
}

export function AssetPage({
  item,
  query,
}: {
  item: AssetNow;
  query: URLSearchParams;
}) {
  const partitions = partitionsOf(item.def.key);
  const tabs = [
    "Overview",
    ...(partitions ? ["Partitions"] : []),
    "Events",
    "Checks",
    "Lineage",
  ];
  const wanted = query.get("tab") ?? "";
  const [tab, setTab] = useState(tabs.includes(wanted) ? wanted : "Overview");
  const [dialog, setDialog] = useState(false);
  const near = [
    item.def.key,
    ...item.def.deps,
    ...item.def.deps.flatMap((key) => [...reach([key], "up")].slice(0, 6)),
    ...(downstream.get(item.def.key) ?? []),
    ...(downstream.get(item.def.key) ?? []).flatMap(
      (key) => downstream.get(key) ?? [],
    ),
  ];
  return (
    <>
      <Header
        art="assets"
        title={item.def.name}
        crumbs={[
          ["Assets", "/assets"],
          [item.def.group, `/assets?group=${item.def.group}`],
        ]}
        subtitle={item.def.description}
        meta={
          <>
            <Pill
              tone={assetStates[item.state][1]}
              label={assetStates[item.state][0]}
            />
            <Kinds kinds={item.def.kinds} />
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => go(`/lineage?focus=${item.def.key}`)}
            >
              <Glyph name="arrow" />
              Show in lineage
            </Button>
            <Button onClick={() => setDialog(true)}>
              <Glyph name="bolt" />
              Materialize
            </Button>
          </>
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "Overview" ? <Overview item={item} onTab={setTab} /> : null}
      {tab === "Partitions" && partitions ? (
        <PartitionMap asset={item.def.key} partitions={partitions} />
      ) : null}
      {tab === "Events" ? <Events item={item} /> : null}
      {tab === "Checks" ? <Checks item={item} /> : null}
      {tab === "Lineage" ? (
        <Lineage
          stateKey={`asset:${item.def.key}`}
          only={near}
          openAll
          focusKey={item.def.key}
        />
      ) : null}
      {dialog ? (
        <MaterializeDialog
          keys={[item.def.key]}
          onClose={() => setDialog(false)}
        />
      ) : null}
    </>
  );
}
