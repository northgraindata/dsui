import { expect, test } from "bun:test";
import { z } from "zod";
import { defineAction } from "../action/index";
import { defineResource } from "../resource/index";
import {
  DependencyGraph,
  Form,
  PageHeader,
  ResourceTree,
  SplitPane,
  Table,
  Tabs,
} from "./nodes";

test("PageHeader requires a title", () => {
  expect(PageHeader({ title: "Databases" }).kind).toBe("page-header");
  expect(() => PageHeader({ title: "" })).toThrow();
});

test("Table accepts a resource binding as source", () => {
  const databases = defineResource({
    id: "databases",
    query: () => [] as string[],
  });
  const node = Table({ source: databases() });
  expect(node.kind).toBe("table");
  expect(node.props.source?.resourceId).toBe("databases");
});

test("Table supports declarative row links and row actions", () => {
  const suspend = defineAction({
    id: "suspend-warehouse",
    input: z.object({ warehouse: z.string() }),
    run: () => "ok",
  });
  const node = Table({
    rowLink: { path: "/warehouses/:warehouse", params: { warehouse: "name" } },
    rowActions: [
      {
        label: "Resume",
        action: suspend,
        input: { warehouse: "name" },
        when: { field: "status", equals: "SUSPENDED" },
      },
    ],
  });
  expect(node.props.rowLink).toEqual({
    path: "/warehouses/:warehouse",
    params: { warehouse: "name" },
  });
  expect(node.props.rowActions?.[0]).toMatchObject({
    label: "Resume",
    when: { field: "status", equals: "SUSPENDED" },
  });
});

test("Table rejects a relative row-link path", () => {
  expect(() =>
    Table({ rowLink: { path: "warehouses/x", params: {} } }),
  ).toThrow("must be absolute");
});

test("DependencyGraph requires the fields that define its edges", () => {
  const tasks = defineResource({ id: "dag-tasks", query: () => [] });
  const node = DependencyGraph({
    source: tasks(),
    idField: "taskId",
    dependsOnField: "upstreamTaskIds",
  });
  expect(node.kind).toBe("dependency-graph");
  expect(() =>
    DependencyGraph({ idField: "", dependsOnField: "upstreamTaskIds" }),
  ).toThrow("idField and dependsOnField");
  expect(() =>
    DependencyGraph({
      idField: "taskId",
      dependsOnField: "upstreamTaskIds",
      rowLink: { path: "tasks/:taskId", params: { taskId: "taskId" } },
    }),
  ).toThrow("must be absolute");
});

test("Tabs requires at least one item", () => {
  expect(() =>
    Tabs({
      items: [
        { label: "A", content: PageHeader({ title: "A" }) },
        { label: "B", content: [PageHeader({ title: "B" })] },
      ],
    }),
  ).not.toThrow();
  expect(() => Tabs({ items: [] })).toThrow();
});

test("Form binds a Zod schema to an action", () => {
  const input = z.object({ size: z.string() });
  const resize = defineAction({ id: "resize", input, run: () => "ok" });
  const node = Form({ schema: input, onSubmit: resize({ size: "X" }) });
  expect(node.kind).toBe("form");
  expect(node.props.onSubmit).toMatchObject({ actionId: "resize" });
});

test("ResourceTree describes lazy children and leaf navigation", () => {
  const databases = defineResource({ id: "databases", query: () => [] });
  const schemas = defineResource({
    id: "schemas",
    input: z.object({ database: z.string() }),
    query: () => [],
  });
  const tree = ResourceTree({
    label: "Data explorer",
    stateKey: "duckdb-data",
    selectedPath: "/data/memory/main/tables/orders",
    branch: {
      source: databases(),
      children: {
        source: schemas({ database: "$name" }),
        rowLink: {
          path: "/data/:database/:schema",
          params: { database: "database", schema: "name" },
        },
      },
    },
  });

  expect(tree.kind).toBe("resource-tree");
  expect(tree.props.branch.children?.rowLink?.path).toBe(
    "/data/:database/:schema",
  );
});

test("SplitPane composes existing nodes without owning their behavior", () => {
  const databases = defineResource({ id: "databases", query: () => [] });
  const pane = SplitPane({
    sidebar: ResourceTree({
      label: "Data explorer",
      branch: { source: databases() },
    }),
    content: PageHeader({ title: "Data" }),
  });

  expect(pane.kind).toBe("split-pane");
  expect(pane.props.sidebar).toMatchObject({ kind: "resource-tree" });
});
