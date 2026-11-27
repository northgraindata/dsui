/* Short histories: one mark for each run or tick, oldest first. */
import { useTip } from "../shared/tip";
import type { Tick } from "./ops";
import { duration, type Run } from "./runs";
import { runStates, tickStates } from "./states";
import { hms, stampSeconds } from "./time";

const SHOWN = 14;

export function RunStrip({ runs }: { runs: readonly Run[] }) {
  const tip = useTip();
  // `runs` arrives newest first.
  const shown = runs.slice(0, SHOWN).reverse();
  const latest = shown.at(-1);
  const failed = shown.filter((run) => run.status === "FAILURE").length;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only; the label says the rest
    <span
      className="ax-strip"
      role="img"
      aria-label={
        latest
          ? `Last ${shown.length} runs: ${failed} failed. Latest ${runStates[latest.status][0].toLowerCase()}, ${stampSeconds(latest.created)}`
          : "No runs"
      }
      onMouseLeave={tip.hide}
    >
      {shown.map((run) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover only
        <i
          key={run.id}
          data-state={runStates[run.status][1]}
          onMouseEnter={(event) =>
            tip.show(
              event,
              <>
                <strong>{runStates[run.status][0]}</strong>
                <span>{stampSeconds(run.created)}</span>
                <span>{hms(duration(run))}</span>
              </>,
            )
          }
        />
      ))}
      {latest ? null : <small>No runs</small>}
      {tip.node}
    </span>
  );
}

export function TickStrip({
  ticks,
  count = 24,
}: {
  ticks: readonly Tick[];
  count?: number;
}) {
  const tip = useTip();
  const shown = ticks.slice(0, count).reverse();
  const failed = shown.filter((tick) => tick.status === "FAILURE").length;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only; the label says the rest
    <span
      className="ax-strip dx-ticks"
      role="img"
      aria-label={`Last ${shown.length} ticks: ${failed} failed`}
      onMouseLeave={tip.hide}
    >
      {shown.map((tick) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover only
        <i
          key={tick.at.getTime()}
          data-state={tickStates[tick.status][1]}
          onMouseEnter={(event) =>
            tip.show(
              event,
              <>
                <strong>{tickStates[tick.status][0]}</strong>
                <span>{stampSeconds(tick.at)}</span>
                {tick.skipReason ? <span>{tick.skipReason}</span> : null}
                {tick.error ? (
                  <span>{tick.error.split(": ").at(-1)}</span>
                ) : null}
                {tick.runs.length ? <span>Run {tick.runs[0]?.id}</span> : null}
              </>,
            )
          }
        />
      ))}
      {tip.node}
    </span>
  );
}
