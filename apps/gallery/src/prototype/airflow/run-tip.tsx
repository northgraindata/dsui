import { hms, type Run, stampSeconds } from "./data";
import { Pill } from "./parts";

export function RunTip({ run }: { run: Run }) {
  return (
    <>
      <Pill state={run.state} />
      <dl>
        <dt>Started</dt>
        <dd>{stampSeconds(run.at)}</dd>
        <dt>{run.state === "running" ? "Running for" : "Duration"}</dt>
        <dd>{hms(run.seconds)}</dd>
      </dl>
    </>
  );
}
