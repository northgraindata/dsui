import { describe, expect, it } from "vitest";
import type { Manifest } from "./api";
import { buildWorkspaceAreas } from "./workspace-navigation";

type View = Manifest["views"][number];

const view = (
  id: string,
  area?: { id: string; label: string; order?: number },
  parent?: string,
): View => ({
  id,
  title: id,
  capability: id,
  renderer: "record-list",
  ...(area
    ? {
        navigation: {
          area,
          ...(parent ? { parent: { capability: parent } } : {}),
        },
      }
    : {}),
});

describe("workspace navigation", () => {
  it("groups views into ordered workspace areas", () => {
    const areas = buildWorkspaceAreas([
      view("queries", { id: "query", label: "Query", order: 20 }),
      view("tables", { id: "explorer", label: "Explorer", order: 10 }),
      view("columns", { id: "explorer", label: "Explorer", order: 10 }),
    ]);

    expect(areas.map((area) => area.id)).toEqual(["explorer", "query"]);
    expect(areas[0]?.views.map((item) => item.id)).toEqual([
      "tables",
      "columns",
    ]);
  });

  it("returns no areas when an adapter uses legacy flat navigation", () => {
    expect(buildWorkspaceAreas([view("tables"), view("query")])).toEqual([]);
  });

  it("keeps ungrouped views reachable in a mixed manifest", () => {
    const areas = buildWorkspaceAreas([
      view("tables", { id: "explorer", label: "Explorer", order: 10 }),
      view("legacy"),
    ]);

    expect(areas.map((area) => area.id)).toEqual(["explorer", "other"]);
    expect(areas[1]?.views[0]?.id).toBe("legacy");
  });

  it("keeps nested capabilities out of primary area tabs", () => {
    const areas = buildWorkspaceAreas([
      view("explorer", { id: "explorer", label: "Explorer", order: 10 }),
      view(
        "table-preview",
        { id: "explorer", label: "Explorer", order: 10 },
        "explorer",
      ),
    ]);

    expect(areas[0]?.views.map((item) => item.id)).toEqual(["explorer"]);
    expect(areas[0]?.allViews.map((item) => item.id)).toEqual([
      "explorer",
      "table-preview",
    ]);
  });
});
