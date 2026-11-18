import { describe, expect, test } from "bun:test";
import { columnKind, columnProfiles, sortQueryRows } from "./column-profile";

describe("query result column profiles", () => {
  test("builds numeric and date distributions from returned rows", () => {
    const profiles = columnProfiles(
      [
        { name: "total", type: "DECIMAL(10,2)" },
        { name: "ordered_at", type: "TIMESTAMP" },
      ],
      [
        { total: "10.5", ordered_at: "2024-01-01" },
        { total: "20.5", ordered_at: "2024-01-03" },
        { total: null, ordered_at: null },
      ],
    );
    expect(profiles[0]?.kind).toBe("number");
    expect(profiles[0]?.nullCount).toBe(1);
    expect(profiles[0]?.distribution).toMatchObject({
      kind: "histogram",
      min: "10.5",
      max: "20.5",
    });
    expect(
      profiles[0]?.distribution.kind === "histogram"
        ? profiles[0].distribution.bins.reduce((sum, value) => sum + value, 0)
        : undefined,
    ).toBe(2);
    expect(profiles[1]?.distribution).toMatchObject({
      kind: "histogram",
      min: "2024-01-01",
      max: "2024-01-03",
    });
  });

  test("reports categorical percentages and distinct count", () => {
    const [profile] = columnProfiles(
      [{ name: "status", type: "VARCHAR" }],
      [
        { status: "open" },
        { status: "open" },
        { status: "closed" },
        { status: null },
      ],
    );
    expect(profile?.distribution.kind).toBe("values");
    if (profile?.distribution.kind !== "values")
      throw new Error("Expected values");
    expect(profile.distribution.distinct).toBe(3);
    expect(profile.distribution.values[0]).toMatchObject({
      label: "open",
      count: 2,
      percentage: 50,
    });
  });

  test("uses types when present, infers missing types, and bounds the sample", () => {
    expect(columnKind("Nullable(UInt64)", [])).toBe("number");
    expect(columnKind("INTERVAL", [])).toBe("unknown");
    expect(columnKind(undefined, [null, true])).toBe("boolean");
    const [profile] = columnProfiles(
      [{ name: "id" }],
      Array.from({ length: 1001 }, (_, id) => ({ id })),
    );
    expect(profile?.sampleSize).toBe(1000);
    expect(profile?.kind).toBe("number");
  });

  test("sorts numeric strings and dates without mutating result rows", () => {
    const rows = [
      { price: "10.5", date: "2024-01-03" },
      { price: "2.5", date: "2024-01-01" },
      { price: null, date: null },
    ];
    const [price, date] = columnProfiles(
      [
        { name: "price", type: "DECIMAL" },
        { name: "date", type: "DATE" },
      ],
      rows,
    );
    if (!price || !date) throw new Error("Expected profiles");
    expect(sortQueryRows(rows, price, "asc").map((row) => row.price)).toEqual([
      "2.5",
      "10.5",
      null,
    ]);
    expect(sortQueryRows(rows, date, "desc").map((row) => row.date)).toEqual([
      "2024-01-03",
      "2024-01-01",
      null,
    ]);
    expect(rows[0]?.price).toBe("10.5");
  });

  test("sorts text values in either direction with nulls last", () => {
    const rows = [{ name: "track 10" }, { name: null }, { name: "track 2" }];
    const [profile] = columnProfiles([{ name: "name", type: "TEXT" }], rows);
    if (!profile) throw new Error("Expected profile");
    expect(sortQueryRows(rows, profile, "asc").map((row) => row.name)).toEqual([
      "track 2",
      "track 10",
      null,
    ]);
    expect(sortQueryRows(rows, profile, "desc").map((row) => row.name)).toEqual(
      ["track 10", "track 2", null],
    );
  });
});
