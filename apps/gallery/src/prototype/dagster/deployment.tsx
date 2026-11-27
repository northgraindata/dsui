/* The instance: code locations, daemons and concurrency. */
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Act, go, Panel, Tabs } from "../shared/ui";
import { assets } from "./graph";
import { jobs } from "./jobs";
import { daemons, instigators, locations, pools } from "./ops";
import { Dot, Header, Pill, runPath } from "./parts";
import { runs, runTitle } from "./runs";
import { stamp, stampSeconds } from "./time";

function Locations() {
  return (
    <div className="dx-locations">
      {[...locations]
        .sort((a, b) => Number(a.loaded) - Number(b.loaded))
        .map((item) => {
          const counts = [
            [
              assets.filter((asset) => asset.location === item.name).length,
              "assets",
            ],
            [jobs.filter((job) => job.location === item.name).length, "jobs"],
            [
              instigators.filter((other) => other.location === item.name)
                .length,
              "schedules and sensors",
            ],
          ].filter(([count]) => count) as [number, string][];
          return (
            <section key={item.name} data-failed={!item.loaded}>
              <header>
                <Dot tone={item.loaded ? "success" : "failed"} />
                <strong>{item.name}</strong>
                <Pill
                  tone={item.loaded ? "success" : "failed"}
                  label={item.loaded ? "Loaded" : "Failed to load"}
                />
                <span className="ax-grow" />
                <Act
                  icon="retry"
                  label="Reload"
                  title={`Reload ${item.name}?`}
                  description="Dagster loads the definitions again from the code server."
                />
              </header>
              <dl>
                <div>
                  <dt>Module</dt>
                  <dd>
                    <code>{item.module}</code>
                  </dd>
                </div>
                <div>
                  <dt>Image</dt>
                  <dd>
                    <code>{item.image}</code>
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{stamp(item.updated)}</dd>
                </div>
                {counts.length ? (
                  <div>
                    <dt>Definitions</dt>
                    <dd>
                      {counts
                        .map(([count, label]) => `${count} ${label}`)
                        .join(" · ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {item.error ? <pre>{item.error}</pre> : null}
            </section>
          );
        })}
    </div>
  );
}

function Daemons() {
  return (
    <Panel flush>
      <div className="ax-table dx-daemon-table" data-dsui-scroll>
        <div className="ax-thead">
          <span />
          <span>Daemon</span>
          <span>Status</span>
          <span>Last heartbeat</span>
        </div>
        {daemons.map(([name, beat]) => (
          <div className="ax-tr ax-tr-static" key={name}>
            <Dot tone="success" />
            <strong>{name}</strong>
            <span>Running</span>
            <span>{stampSeconds(beat)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Concurrency() {
  const queued = runs.filter((run) => run.status === "QUEUED");
  return (
    <>
      <div className="dx-pools">
        {pools.map((pool) => (
          <article key={pool.name}>
            <header>
              <code>{pool.name}</code>
              {pool.used >= pool.limit ? (
                <span className="ax-warn">Full</span>
              ) : null}
            </header>
            <div
              className="ax-slots"
              role="img"
              aria-label={`${pool.used} of ${pool.limit} slots used`}
            >
              {Array.from({ length: pool.limit }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: slots have no identity
                <i key={index} data-used={index < pool.used} />
              ))}
            </div>
            <small>
              {pool.used} of {pool.limit} slots used
              {pool.queued ? ` · ${pool.queued} waiting` : ""}
            </small>
            <Act
              icon="edit"
              label="Change limit"
              title={`Change the limit of ${pool.name}?`}
              description="Runs already started keep their slots."
            />
          </article>
        ))}
      </div>
      <Panel title={`Queued runs (${queued.length})`} flush>
        {queued.map((run) => (
          <button
            type="button"
            className="ax-row"
            key={run.id}
            onClick={() => go(runPath(run.id))}
          >
            <Dot tone="queued" />
            <code>{run.id}</code>
            <strong>{runTitle(run)}</strong>
            <small>{run.waiting}</small>
            <Glyph name="right" size={13} />
          </button>
        ))}
        {queued.length ? null : <p className="ax-empty">No run is queued.</p>}
      </Panel>
    </>
  );
}

export function Deployment({ query }: { query: URLSearchParams }) {
  const tabs = ["Code locations", "Daemons", "Concurrency"];
  const wanted = query.get("tab") ?? "";
  const [tab, setTab] = useState(
    tabs.includes(wanted) ? wanted : "Code locations",
  );
  return (
    <>
      <Header art="deployment" title="Deployment" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "Code locations" ? <Locations /> : null}
      {tab === "Daemons" ? <Daemons /> : null}
      {tab === "Concurrency" ? <Concurrency /> : null}
    </>
  );
}
