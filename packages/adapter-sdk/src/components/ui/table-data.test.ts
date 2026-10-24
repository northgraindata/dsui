import { describe, expect, test } from "bun:test";
import type { TableColumn } from "../primitives/table";
import { columnOptions, exploreRows, tableInsights } from "./table-data";

const columns: TableColumn[] = [
  { id: "track_id", label: "track_id" },
  { id: "album_name", label: "album_name" },
  { id: "duration_seconds", label: "duration_seconds" },
];

const rows = [
  { track_id: 101, album_name: "Discovery", duration_seconds: 247 },
  { track_id: 102, album_name: "Discovery", duration_seconds: 224 },
  { track_id: 103, album_name: "Homogenic", duration_seconds: 312 },
  { track_id: 104, album_name: null, duration_seconds: 132 },
];

describe("table preview exploration", () => {
  test("filters, searches, and sorts loaded rows without mutating their order", () => {
    const discovery = columnOptions(rows, "album_name")[0];
    expect(discovery).toMatchObject({ label: "Discovery", count: 2 });
    const visible = exploreRows({
      rows,
      columns,
      search: "disco",
      filters: { album_name: [discovery.key] },
      sort: { columnId: "duration_seconds", direction: "asc" },
    });
    expect(visible.map((row) => row.track_id)).toEqual([102, 101]);
    expect(rows.map((row) => row.track_id)).toEqual([101, 102, 103, 104]);
  });

  test("uses row value keys for declared filter options", () => {
    const [option] = columnOptions(rows, "track_id", {
      field: "track_id",
      label: "Track",
      options: [{ label: "Track 101", value: "101" }],
    });
    expect(option.count).toBe(1);
    expect(
      exploreRows({
        rows,
        columns,
        search: "",
        filters: { track_id: [option.key] },
      }).map((row) => row.track_id),
    ).toEqual([101]);
  });

  test("profiles the loaded sample and prefers a measure over an id", () => {
    const insights = tableInsights(rows, columns);
    expect(insights.sampleSize).toBe(4);
    expect(insights.numeric).toMatchObject({
      column: { id: "duration_seconds" },
      min: 132,
      max: 312,
      average: 228.75,
    });
    expect(insights.top?.values[0]).toMatchObject({
      label: "Discovery",
      count: 2,
    });
    expect(insights.distinct.map((item) => item.count)).toEqual([4, 3]);
  });
});
