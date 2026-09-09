import { expect, test } from "bun:test";
import {
  clampOffset,
  GRAPH_NODE_WIDTH,
  graphNodeFromRow,
  layoutDependencyGraph,
  restingOffset,
} from "./graph-layout";

const CANVAS = { width: 800, height: 500 };

test("places dependents to the right of everything they depend on", () => {
  const layout = layoutDependencyGraph([
    { id: "extract", label: "extract", dependsOn: [] },
    { id: "load", label: "load", dependsOn: ["extract", "transform"] },
    { id: "transform", label: "transform", dependsOn: ["extract"] },
  ]);
  expect(layout.nodes.map((node) => [node.id, node.layer])).toEqual([
    ["extract", 0],
    ["load", 2],
    ["transform", 1],
  ]);
  expect(layout.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
    "extract->load",
    "transform->load",
    "extract->transform",
  ]);
  expect(layout.width).toBeGreaterThan(GRAPH_NODE_WIDTH * 3);
});

test("stacks independent nodes in input order within one layer", () => {
  const layout = layoutDependencyGraph([
    { id: "a", label: "a", dependsOn: [] },
    { id: "b", label: "b", dependsOn: [] },
  ]);
  const [first, second] = layout.nodes;
  expect(first.x).toBe(second.x);
  expect(second.y).toBeGreaterThan(first.y);
});

test("centres a short column against the tallest one", () => {
  const layout = layoutDependencyGraph([
    { id: "a", label: "a", dependsOn: [] },
    { id: "b", label: "b", dependsOn: [] },
    { id: "merge", label: "merge", dependsOn: ["a", "b"] },
  ]);
  const [a, b, merge] = layout.nodes;
  expect(merge.y).toBe((a.y + b.y) / 2);
});

test("ignores self edges and dependencies outside the graph", () => {
  const layout = layoutDependencyGraph([
    { id: "only", label: "only", dependsOn: ["only", "missing"] },
  ]);
  expect(layout.nodes[0].layer).toBe(0);
  expect(layout.edges).toEqual([]);
});

test("lays out a cyclic dependency set instead of recursing forever", () => {
  const layout = layoutDependencyGraph([
    { id: "a", label: "a", dependsOn: ["b"] },
    { id: "b", label: "b", dependsOn: ["a"] },
  ]);
  expect(layout.nodes).toHaveLength(2);
  expect(layout.edges).toHaveLength(2);
});

test("centres a board that fits and anchors a wider one at its roots", () => {
  expect(restingOffset(CANVAS, { width: 400, height: 200 })).toEqual({
    x: 200,
    y: 150,
  });
  expect(restingOffset(CANVAS, { width: 2000, height: 200 })).toEqual({
    x: 0,
    y: 150,
  });
});

test("panning keeps part of the board on the canvas in both directions", () => {
  const board = { width: 2000, height: 900 };
  expect(clampOffset({ x: -5000, y: -5000 }, CANVAS, board)).toEqual({
    x: 96 - 2000,
    y: 96 - 900,
  });
  expect(clampOffset({ x: 5000, y: 5000 }, CANVAS, board)).toEqual({
    x: 800 - 96,
    y: 500 - 96,
  });
  expect(clampOffset({ x: -120, y: 40 }, CANVAS, board)).toEqual({
    x: -120,
    y: 40,
  });
});

test("a board narrower than the visible margin can still be panned fully", () => {
  const board = { width: 60, height: 40 };
  expect(clampOffset({ x: -5000, y: -5000 }, CANVAS, board)).toEqual({
    x: 0,
    y: 0,
  });
  expect(clampOffset({ x: 5000, y: 5000 }, CANVAS, board)).toEqual({
    x: 800 - 60,
    y: 500 - 40,
  });
});

test("reads label, detail, and dependency fields from an adapter row", () => {
  expect(
    graphNodeFromRow(
      {
        taskId: "load",
        name: "Load",
        operator: "PythonOperator",
        upstreamTaskIds: ["extract"],
      },
      {
        idField: "taskId",
        dependsOnField: "upstreamTaskIds",
        labelField: "name",
        detailField: "operator",
      },
    ),
  ).toEqual({
    id: "load",
    label: "Load",
    detail: "PythonOperator",
    dependsOn: ["extract"],
  });
});

test("falls back to the id and skips rows without one", () => {
  const fields = { idField: "taskId", dependsOnField: "upstreamTaskIds" };
  expect(graphNodeFromRow({ taskId: "solo" }, fields)).toEqual({
    id: "solo",
    label: "solo",
    dependsOn: [],
  });
  expect(graphNodeFromRow({ upstreamTaskIds: [] }, fields)).toBeNull();
});
