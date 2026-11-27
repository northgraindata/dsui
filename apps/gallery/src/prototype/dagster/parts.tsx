import { Tooltip } from "@northgraindata/dsui-ui";
import type { ComponentProps, CSSProperties } from "react";
import {
  kindKey,
  kindStyle,
} from "../../../../../packages/adapter-dagster/src/components/kinds";
import { Glyph } from "../shared/glyphs";
import { go, Header as PageHeader } from "../shared/ui";
import { Art, type ArtName } from "./art";
import {
  type AssetNow,
  assetStates,
  failing,
  type Partitions,
} from "./catalog";
import { type Launcher, type Run, runTitle } from "./runs";
import { type BackfillStatus, backfillStates, runStates } from "./states";
import { stamp } from "./time";

export function Header({
  art,
  ...props
}: Omit<ComponentProps<typeof PageHeader>, "art"> & { art: ArtName }) {
  return <PageHeader {...props} art={<Art name={art} size={52} />} />;
}

export const assetPath = (key: string) => `/assets/${key}`;
export const runPath = (id: string) => `/runs/${id}`;

export function Dot({ tone, label }: { tone: string; label?: string }) {
  return label ? (
    <i
      className="ax-dot"
      data-state={tone}
      role="img"
      aria-label={label}
      title={label}
    />
  ) : (
    <i className="ax-dot" data-state={tone} aria-hidden="true" />
  );
}

export function Pill({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="ax-pill" data-state={tone}>
      <i className="ax-dot" data-state={tone} aria-hidden="true" />
      {label}
    </span>
  );
}

export function RunPill({ run }: { run: Run }) {
  const [label, tone] = runStates[run.status];
  return <Pill tone={tone} label={label} />;
}

export function BackfillPill({ status }: { status: BackfillStatus }) {
  const [label, tone] = backfillStates[status];
  return <Pill tone={tone} label={label} />;
}

/** The technology's own icon from Dagster's set, or a plain mark. */
export function KindMark({ kind, size = 16 }: { kind: string; size?: number }) {
  const style = kindStyle(kind);
  return (
    <span
      className="dx-kind"
      style={
        {
          "--kind": style.color ?? "var(--color-text-faint)",
          width: size,
          height: size,
        } as CSSProperties
      }
      title={kindLabel(kind)}
      role="img"
      aria-label={kindLabel(kind)}
    >
      {style.icon ? (
        <i
          data-mono={style.mono || undefined}
          style={
            style.mono
              ? { maskImage: `url("${style.icon}")` }
              : { backgroundImage: `url("${style.icon}")` }
          }
        />
      ) : (
        <Glyph name="plug" size={size - 3} />
      )}
    </span>
  );
}

/** Names Dagster has no icon or label for, written as their owners do. */
const names: Record<string, string> = { hubspot: "HubSpot" };
export const kindLabel = (kind: string) => names[kind] ?? kindStyle(kind).label;
export { kindKey };

export function Kinds({ kinds }: { kinds: readonly string[] }) {
  return (
    <span className="dx-kinds">
      {kinds.slice(0, 2).map((kind) => (
        <span className="ax-chip-tag" key={kind}>
          <KindMark kind={kind} size={13} />
          {kindLabel(kind)}
        </span>
      ))}
      {kinds.length > 2 ? (
        <Tooltip label={kinds.slice(2).map(kindLabel).join(", ")}>
          <button type="button" className="ax-tags-more">
            +{kinds.length - 2}
          </button>
        </Tooltip>
      ) : null}
    </span>
  );
}

export const stateLine = (item: AssetNow) => {
  const label = assetStates[item.state][0];
  if (item.state === "failed" && item.failedRun)
    return `${label} ${stamp(item.failedRun.created)}`;
  if (item.state === "materializing" || !item.latest) return label;
  if (item.state === "stale") return `${label} · ${stamp(item.latest.at)}`;
  return stamp(item.latest.at);
};

export function CheckCount({ item }: { item: AssetNow }) {
  if (!item.checks.length) return <span className="ax-muted">—</span>;
  const failed = failing(item);
  const passed = item.checks.filter((check) => check.status === "SUCCEEDED");
  const blocking = failed.some((check) => check.severity === "ERROR");
  const text = failed.length
    ? `${failed.length} failed`
    : passed.length === item.checks.length
      ? `${passed.length} passed`
      : "In progress";
  return (
    <span
      className="dx-checks"
      data-state={
        failed.length
          ? blocking
            ? "failed"
            : "up_for_retry"
          : passed.length === item.checks.length
            ? "success"
            : "running"
      }
      title={item.checks.map((check) => check.name).join(", ")}
    >
      <Glyph name={failed.length ? "alert" : "check"} size={12} />
      {text}
    </span>
  );
}

export function PartitionBar({
  partitions,
  label = true,
}: {
  partitions: Partitions;
  label?: boolean;
}) {
  const total = partitions.keys.length;
  const parts: [string, number][] = [
    ["success", partitions.materialized],
    ["failed", partitions.failed.size],
    ["running", partitions.materializing.size],
    ["none", partitions.missing.size],
  ];
  const text = `${partitions.materialized.toLocaleString("en")} of ${total.toLocaleString("en")} partitions materialized${partitions.failed.size ? `, ${partitions.failed.size} failed` : ""}${partitions.missing.size ? `, ${partitions.missing.size} missing` : ""}`;
  return (
    <span className="dx-partition-bar" title={text}>
      <span role="img" aria-label={text}>
        {parts.map(([tone, count]) =>
          count ? (
            // A few failures in hundreds must still be visible.
            <i
              key={tone}
              data-state={tone}
              style={{ flexGrow: Math.max(count, total * 0.03) }}
            />
          ) : null,
        )}
      </span>
      {label ? (
        <small>
          {partitions.materialized.toLocaleString("en")}/
          {total.toLocaleString("en")}
        </small>
      ) : null}
    </span>
  );
}

const launchers: Record<Launcher["kind"], [string, ArtName]> = {
  schedule: ["Schedule", "automation"],
  sensor: ["Sensor", "automation"],
  automation: ["Automation", "automation"],
  backfill: ["Backfill", "partitions"],
  manual: ["Manual", "runs"],
};

export function LaunchedBy({ by }: { by: Launcher }) {
  const [kind] = launchers[by.kind];
  const target =
    by.kind === "backfill"
      ? `/backfills/${by.name}`
      : by.kind === "manual"
        ? undefined
        : `/automation/${by.name}`;
  const text = by.kind === "manual" ? "Manual" : by.name;
  return (
    <span className="dx-by">
      <small>{kind}</small>
      {target ? (
        <button
          type="button"
          className="ax-link"
          title={text}
          onClick={(event) => {
            event.stopPropagation();
            go(target);
          }}
        >
          {text}
        </button>
      ) : null}
    </span>
  );
}

export const runLabel = (run: Run) =>
  `${runTitle(run)}${run.partition ? ` · ${run.partition}` : ""}`;
