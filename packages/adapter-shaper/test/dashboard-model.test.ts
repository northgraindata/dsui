import { describe, expect, test } from "bun:test";
import type { ShaperDashboard } from "../src/context.js";
import {
  buildDashboardView,
  columnLabel,
  summarizeDashboard,
} from "../src/dashboard-model.js";
import fixture from "./fixtures/rich-dashboard.json";

const dashboard = fixture as unknown as ShaperDashboard;

describe("columnLabel", () => {
  test("unwraps Shaper's tag casts", () => {
    expect(columnLabel('CAST(CAST(d AS "DATE") AS "XAXIS")')).toBe("d");
    expect(columnLabel("revenue")).toBe("revenue");
    expect(columnLabel('"Total sales"')).toBe("Total sales");
  });
});

describe("buildDashboardView", () => {
  const view = buildDashboardView(dashboard);
  const blocks = view.sections.flatMap((section) => section.blocks);

  test("keeps section titles and drops empty sections", () => {
    expect(view.title).toBe("Revenue overview");
    expect(view.sections[0]?.title).toBe("Revenue overview");
  });

  test("maps a line chart to aligned series on a time axis", () => {
    const line = blocks.find((block) => block.kind === "line");
    expect(line?.kind).toBe("line");
    if (line?.kind !== "line") return;
    expect(line.xType).toBe("time");
    expect(line.x).toHaveLength(5);
    expect(line.series).toHaveLength(1);
    expect(line.series[0]?.values).toHaveLength(5);
  });

  test("pivots a categorised bar chart into one series per category", () => {
    const bar = blocks.find((block) => block.kind === "bar");
    if (bar?.kind !== "bar") throw new Error("missing bar chart");
    expect(bar.stacked).toBe(true);
    expect(bar.orientation).toBe("horizontal");
    expect(bar.series.map((series) => series.name).sort()).toEqual([
      "app",
      "web",
    ]);
    expect(
      bar.series.every((series) =>
        series.values.every((value) => value !== null),
      ),
    ).toBe(true);
  });

  test("maps pie slices, gauge ranges and dropdown options", () => {
    const pie = blocks.find((block) => block.kind === "pie");
    expect(pie).toMatchObject({
      slices: [
        { name: "a", value: 3 },
        { name: "b", value: 5 },
      ],
    });
    const gauge = blocks.find((block) => block.kind === "gauge");
    expect(gauge).toMatchObject({ value: 72, ranges: [{ from: 0, to: 100 }] });
    const control = blocks.find((block) => block.kind === "control");
    expect(control).toMatchObject({
      variable: "region",
      options: ["eu", "us"],
    });
  });

  test("falls back to a table that names the unsupported type", () => {
    const view = buildDashboardView({
      name: "",
      sections: [
        {
          title: null,
          type: "content",
          queries: [
            {
              render: { type: "boxplot", label: "Spread" },
              columns: [
                { name: "v", type: "number", nullable: false, tag: "" },
              ],
              rows: [[1]],
            },
          ],
        },
      ],
    });
    expect(view.sections[0]?.blocks[0]).toMatchObject({
      kind: "table",
      fallbackFor: "boxplot",
    });
  });

  test("treats a chart without tagged columns as a table instead of dropping it", () => {
    const view = buildDashboardView({
      name: "",
      sections: [
        {
          title: null,
          type: "content",
          queries: [
            {
              render: { type: "linechart", label: "x" },
              columns: [
                { name: "v", type: "number", nullable: false, tag: "" },
              ],
              rows: [[1]],
            },
          ],
        },
      ],
    });
    expect(view.sections[0]?.blocks[0]?.kind).toBe("table");
  });

  test("a reloadAt of zero means no scheduled refresh", () => {
    expect(view.reloadAt).toBeNull();
  });
});

describe("summarizeDashboard", () => {
  const summary = summarizeDashboard(dashboard);
  const queries = summary.sections.flatMap((section) => section.queries);

  test("keeps titles and readable column names", () => {
    const revenue = queries.find((query) => query.title === "Total revenue");
    expect(revenue?.columns[0]).toBe("revenue");
    expect(revenue?.rows[0]?.[0]).toBe(1234567.5);
  });

  test("writes dates as ISO strings", () => {
    const line = queries.find((query) => query.title === "Revenue by week");
    expect(line?.rows[0]?.[0]).toBe("2026-01-01");
  });
});
