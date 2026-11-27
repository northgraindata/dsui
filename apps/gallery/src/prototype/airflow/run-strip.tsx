import { useTip } from "../shared/tip";
import { type Dag, historyOf, hms, stampSeconds } from "./data";
import { stateLabel } from "./parts";
import { RunTip } from "./run-tip";

const SHOWN = 14;

export function RunStrip({ dag }: { dag: Dag }) {
  const tip = useTip();
  const runs = historyOf(dag).slice(-SHOWN);
  const failed = runs.filter((run) => run.state === "failed").length;
  const latest = runs.at(-1);
  return (
    // One element, not fourteen buttons: a long list stays usable by keyboard.
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only; the label says the rest
    <span
      className="ax-strip"
      role="img"
      aria-label={
        latest
          ? `Last ${runs.length} runs: ${failed} failed. Latest ${stateLabel[latest.state].toLowerCase()}, ${stampSeconds(latest.at)}, ${hms(latest.seconds)}`
          : "No runs"
      }
      onMouseLeave={tip.hide}
    >
      {runs.map((run) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover only
        <i
          key={run.at.getTime()}
          data-state={run.state}
          onMouseEnter={(event) => tip.show(event, <RunTip run={run} />)}
        />
      ))}
      {tip.node}
    </span>
  );
}
