/* Schedules and sensors: whether they run, and what their ticks did. */
import { Button, ConfirmDialog, notify } from "@northgraindata/dsui-ui";
import { useState, useSyncExternalStore } from "react";
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
import { type Instigator, instigators } from "./ops";
import { Dot, Header, Pill, runPath } from "./parts";
import { type TickStatus, tickStates } from "./states";
import { TickStrip } from "./strips";
import { stamp, stampSeconds } from "./time";

let version = 0;
const listeners = new Set<() => void>();
const useRunning = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );

/** Start or stop, confirmed, with the row showing the result. */
function Toggle({
  item,
  labelled = false,
}: {
  item: Instigator;
  labelled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const verb = item.running ? "Stop" : "Start";
  const icon = item.running ? "pause" : "play";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keeps row clicks out
    // biome-ignore lint/a11y/useKeyWithClickEvents: keeps row clicks out
    <span onClick={(event) => event.stopPropagation()}>
      {labelled ? (
        <Button
          variant={item.running ? "secondary" : "default"}
          onClick={() => setOpen(true)}
        >
          <Glyph name={icon} />
          {verb}
        </Button>
      ) : (
        <IconButton
          icon={icon}
          label={`${verb} ${item.name}`}
          onClick={() => setOpen(true)}
        />
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`${verb} ${item.name}?`}
        description={
          item.running
            ? "It stops launching runs. Runs already launched continue."
            : `It starts launching runs${item.kind === "schedule" ? " at its next scheduled time" : ""}.`
        }
        confirmLabel={verb}
        onConfirm={() => {
          item.running = !item.running;
          version += 1;
          for (const listener of listeners) listener();
          notify.success(
            `${item.name} ${item.running ? "started" : "stopped"}`,
          );
        }}
      />
    </span>
  );
}

const lastTick = (item: Instigator) => item.ticks[0];

export function Automation() {
  useRunning();
  const [filters, setFilters] = useRemembered("dx:automation", {
    kind: "schedule",
    search: "",
    state: "",
    location: "",
  });
  const ofKind = instigators.filter((item) => item.kind === filters.kind);
  const rows = ofKind.filter(
    (item) =>
      `${item.name} ${item.target}`.includes(filters.search.toLowerCase()) &&
      (!filters.location || item.location === filters.location) &&
      (!filters.state ||
        (filters.state === "failing"
          ? item.running && lastTick(item)?.status === "FAILURE"
          : filters.state === "running"
            ? item.running
            : !item.running)),
  );
  const { visible, pager } = usePages(
    "dx:automation",
    rows,
    JSON.stringify(filters),
  );
  const schedules = filters.kind === "schedule";
  return (
    <>
      <Header art="automation" title="Automation" />
      <Toolbar>
        <Segments
          label="Kind"
          value={filters.kind}
          onChange={(kind) => setFilters({ ...filters, kind })}
          options={[
            {
              value: "schedule",
              label: "Schedules",
              count: instigators.filter((item) => item.kind === "schedule")
                .length,
            },
            {
              value: "sensor",
              label: "Sensors",
              count: instigators.filter((item) => item.kind === "sensor")
                .length,
            },
          ]}
        />
        <span className="ax-grow" />
        <Search
          label="Search name or target"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
        <Choice
          all="Any status"
          value={filters.state}
          options={["running", "stopped", "failing"]}
          names={{ running: "Running", stopped: "Stopped", failing: "Failing" }}
          onChange={(state) => setFilters({ ...filters, state })}
        />
        <Choice
          all="All code locations"
          value={filters.location}
          options={unique(instigators.map((item) => item.location))}
          onChange={(location) => setFilters({ ...filters, location })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table dx-automation-table" data-dsui-scroll>
          <div className="ax-thead">
            <span />
            <span>{schedules ? "Schedule" : "Sensor"}</span>
            <span>{schedules ? "Runs" : "Checks"}</span>
            <span>Recent ticks</span>
            <span>Next tick</span>
            <span />
          </div>
          {visible.map((item) => {
            const tick = lastTick(item);
            const broken = item.running && tick?.status === "FAILURE";
            return (
              // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
              <div
                className="ax-tr"
                role="link"
                tabIndex={0}
                key={item.name}
                onClick={() => go(`/automation/${item.name}`)}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  event.target === event.currentTarget &&
                  go(`/automation/${item.name}`)
                }
              >
                <Dot
                  tone={broken ? "failed" : item.running ? "success" : "none"}
                  label={
                    broken ? "Failing" : item.running ? "Running" : "Stopped"
                  }
                />
                <span className="dx-two">
                  <strong title={item.name}>{item.name}</strong>
                  <small>
                    {item.kind === "sensor" ? `${item.sensorType} · ` : ""}
                    {item.target}
                  </small>
                </span>
                <span className="dx-two">
                  <span>{item.cronText ?? item.interval}</span>
                  <small>
                    {item.cron
                      ? `${item.cron} · Europe/Warsaw`
                      : "Evaluation interval"}
                  </small>
                </span>
                <TickStrip ticks={item.ticks} />
                <span>
                  {item.running && item.next ? stamp(item.next) : "Stopped"}
                </span>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
                <span
                  className="ax-row-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Toggle item={item} />
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
              setFilters({ ...filters, search: "", state: "", location: "" })
            }
          />
        )}
      </Panel>
    </>
  );
}

export function InstigatorPage({ item }: { item: Instigator }) {
  useRunning();
  const [status, setStatus] = useState<TickStatus | "all">("all");
  const rows = item.ticks.filter(
    (tick) => status === "all" || tick.status === status,
  );
  const { visible, pager } = usePages(`dx:ticks:${item.name}`, rows, status);
  const latest = lastTick(item);
  return (
    <>
      <Header
        art="automation"
        title={item.name}
        crumbs={[["Automation", "/automation"]]}
        meta={
          <>
            <Pill
              tone={item.running ? "success" : "none"}
              label={item.running ? "Running" : "Stopped"}
            />
            <span className="ax-chip">
              {item.kind === "schedule"
                ? "Schedule"
                : `${item.sensorType} sensor`}
            </span>
            <span>
              {item.cronText ?? item.interval}
              {item.cron ? ` (${item.cron}, Europe/Warsaw)` : ""}
            </span>
            {item.job ? (
              <button
                type="button"
                className="ax-link"
                onClick={() => go(`/jobs/${item.job}`)}
              >
                {item.job}
              </button>
            ) : (
              <span>{item.target}</span>
            )}
            {item.running && item.next ? (
              <span>Next tick {stamp(item.next)}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                notify.success(
                  "Test evaluation: no runs requested (prototype)",
                  { description: latest?.skipReason },
                )
              }
            >
              Test {item.kind}
            </Button>
            <Toggle item={item} labelled />
          </>
        }
      />
      {item.running && latest?.error ? (
        <section className="dx-tick-error">
          <strong>The latest tick failed {stampSeconds(latest.at)}</strong>
          <pre>{latest.error}</pre>
        </section>
      ) : null}
      <Panel title="Recent ticks">
        <TickStrip ticks={item.ticks} count={60} />
      </Panel>
      <Toolbar>
        <Segments
          label="Tick status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: item.ticks.length },
            ...(["SUCCESS", "SKIPPED", "FAILURE"] as const).map((value) => ({
              value,
              label: tickStates[value][0],
              tone: tickStates[value][1],
              count: item.ticks.filter((tick) => tick.status === value).length,
            })),
          ]}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table dx-tick-table" data-dsui-scroll>
          <div className="ax-thead">
            <span />
            <span>Time</span>
            <span>Result</span>
            <span>Details</span>
          </div>
          {visible.map((tick) => {
            const detail = tick.skipReason ?? tick.error;
            return (
              <div className="ax-tr ax-tr-static" key={tick.at.getTime()}>
                <Dot tone={tickStates[tick.status][1]} />
                <span>{stampSeconds(tick.at)}</span>
                <span>{tickStates[tick.status][0]}</span>
                {tick.runs.length ? (
                  <span className="dx-links">
                    {tick.runs.map((run) => (
                      <button
                        type="button"
                        className="ax-link"
                        key={run.id}
                        onClick={() => go(runPath(run.id))}
                      >
                        Run {run.id}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="dx-ellipsis" title={detail}>
                    {detail ?? "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {rows.length ? (
          pager
        ) : (
          <Empty filtered onClear={() => setStatus("all")} />
        )}
      </Panel>
    </>
  );
}
