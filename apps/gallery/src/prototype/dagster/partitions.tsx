/* The partition map: every partition's state, and a range to act on. */
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Segments } from "../shared/list";
import { useTip } from "../shared/tip";
import type { Partitions } from "./catalog";
import { MaterializeDialog } from "./materialize";
import { Dot } from "./parts";

const month = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

const tones = {
  success: "Materialized",
  failed: "Failed",
  running: "Materializing",
  none: "Missing",
} as const;
type Tone = keyof typeof tones;

export function PartitionMap({
  asset,
  partitions,
}: {
  asset: string;
  partitions: Partitions;
}) {
  const tip = useTip();
  const monthly = (partitions.keys[0]?.length ?? 0) === 7;
  const years = [
    ...new Set(partitions.keys.map((key) => key.slice(0, 4))),
  ].reverse();
  const [year, setYear] = useState(years[0] ?? "");
  const [range, setRange] = useState<[string, string]>();
  const [dialog, setDialog] = useState(false);
  const toneOf = (key: string): Tone =>
    partitions.failed.has(key)
      ? "failed"
      : partitions.materializing.has(key)
        ? "running"
        : partitions.missing.has(key)
          ? "none"
          : "success";
  const inYear = partitions.keys.filter((key) => key.startsWith(year));
  const rows = monthly
    ? [[year, inYear] as const]
    : [...new Set(inYear.map((key) => key.slice(0, 7)))].map(
        (prefix) =>
          [
            month[Number(prefix.slice(5)) - 1] ?? "",
            inYear.filter((key) => key.startsWith(prefix)),
          ] as const,
      );
  const selected = range
    ? partitions.keys.filter((key) => key >= range[0] && key <= range[1])
    : [];
  const pick = (key: string, extend: boolean) =>
    setRange(
      extend && range
        ? [key < range[0] ? key : range[0], key > range[1] ? key : range[1]]
        : [key, key],
    );
  const totals: [Tone, number][] = [
    ["success", partitions.materialized],
    ["failed", partitions.failed.size],
    ["running", partitions.materializing.size],
    ["none", partitions.missing.size],
  ];
  const problem = [...partitions.failed, ...partitions.missing].sort();
  return (
    <div className="dx-partitions">
      <div className="dx-partitions-head">
        <span className="ax-legend">
          {totals.map(([tone, count]) => (
            <span key={tone}>
              <Dot tone={tone} />
              {tones[tone]} {count.toLocaleString("en")}
            </span>
          ))}
        </span>
        <span className="ax-grow" />
        <Segments
          label="Year"
          value={year}
          onChange={setYear}
          options={years.map((value) => ({
            value,
            label: value,
            count:
              partitions.keys.filter(
                (key) =>
                  key.startsWith(value) &&
                  (partitions.failed.has(key) || partitions.missing.has(key)),
              ).length || undefined,
          }))}
        />
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only hides the tooltip */}
      <div
        className="dx-calendar"
        data-monthly={monthly}
        onMouseLeave={tip.hide}
        data-dsui-scroll
      >
        {rows.map(([name, keys]) => (
          <div key={name}>
            <span>{name}</span>
            <div>
              {keys.map((key) => (
                <button
                  type="button"
                  key={key}
                  data-state={toneOf(key)}
                  aria-label={`${key}, ${tones[toneOf(key)]}`}
                  aria-pressed={selected.includes(key)}
                  onClick={(event) => pick(key, event.shiftKey)}
                  onMouseEnter={(event) =>
                    tip.show(
                      event,
                      <>
                        <strong>{key}</strong>
                        <span>{tones[toneOf(key)]}</span>
                      </>,
                    )
                  }
                >
                  {monthly ? month[Number(key.slice(5)) - 1] : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="dx-partitions-foot">
        {range ? (
          <>
            <strong>
              {selected.length === 1
                ? range[0]
                : `${range[0]} to ${range[1]} · ${selected.length} partitions`}
            </strong>
            <span className="ax-grow" />
            <Button size="small" onClick={() => setDialog(true)}>
              <Glyph name="bolt" size={13} />
              Materialize {selected.length === 1 ? "partition" : "range"}
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => setRange(undefined)}
            >
              Clear
            </Button>
          </>
        ) : (
          <>
            <small>
              Select a partition. Shift-click another to select the range
              between them.
            </small>
            <span className="ax-grow" />
            {problem.length ? (
              <Button size="small" onClick={() => setDialog(true)}>
                <Glyph name="bolt" size={13} />
                Materialize {problem.length} missing and failed
              </Button>
            ) : null}
          </>
        )}
      </div>
      {tip.node}
      {dialog ? (
        <MaterializeDialog
          keys={[asset]}
          range={range}
          onClose={() => setDialog(false)}
        />
      ) : null}
    </div>
  );
}
