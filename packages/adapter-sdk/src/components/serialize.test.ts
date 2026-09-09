import { expect, test } from "bun:test";
import { z } from "zod";
import { defineResource } from "../resource/index";
import {
  DependencyGraph,
  PageHeader,
  QueryWorkbench,
  ResourceTree,
  SplitPane,
  Table,
} from "./nodes";
import { serializeNodes } from "./serialize";

test("serializes static page nodes and resource bindings", () => {
  const things = defineResource({ id: "things", query: () => [] });
  expect(
    serializeNodes([
      PageHeader({ title: "Things" }),
      Table({ source: things() }),
    ]),
  ).toEqual([
    { kind: "page-header", props: { title: "Things" } },
    { kind: "table", props: { source: { resourceId: "things" } } },
  ]);
});

test("serializes declarative row links and row actions", () => {
  expect(
    serializeNodes([
      Table({
        rowLink: { path: "/things/:name", params: { name: "name" } },
        rowActions: [
          {
            label: "Refresh",
            variant: "danger",
            action: "refresh",
            input: { name: "name" },
            when: { field: "stale", equals: true },
          },
        ],
      }),
    ]),
  ).toEqual([
    {
      kind: "table",
      props: {
        rowLink: { path: "/things/:name", params: { name: "name" } },
        rowActions: [
          {
            label: "Refresh",
            variant: "danger",
            action: { actionId: "refresh", input: { name: "name" } },
            when: { field: "stale", equals: true },
          },
        ],
      },
    },
  ]);
});

test("serializes a dependency graph binding", () => {
  const tasks = defineResource({ id: "dag-tasks", query: () => [] });
  expect(
    serializeNodes(
      DependencyGraph({
        source: tasks(),
        idField: "taskId",
        dependsOnField: "upstreamTaskIds",
        labelField: "name",
      }),
    ),
  ).toEqual([
    {
      kind: "dependency-graph",
      props: {
        source: { resourceId: "dag-tasks" },
        idField: "taskId",
        dependsOnField: "upstreamTaskIds",
        labelField: "name",
      },
    },
  ]);
});

test("serializes a browser-owned query workbench", () => {
  const runQuery = { kind: "action", id: "run-query" } as const;
  const databases = defineResource({ id: "databases", query: () => [] });
  const schemas = defineResource({
    id: "schemas",
    input: z.object({ database: z.string() }),
    query: () => [],
  });
  expect(
    serializeNodes(
      QueryWorkbench({
        language: "sql",
        value: "SELECT 42",
        action: runQuery,
        explorer: {
          source: databases(),
          children: { source: schemas({ database: "$name" }) },
        },
      }),
    ),
  ).toEqual([
    {
      kind: "query-workbench",
      props: {
        language: "sql",
        value: "SELECT 42",
        action: { actionId: "run-query" },
        explorer: {
          source: { resourceId: "databases" },
          children: {
            source: { resourceId: "schemas", input: { database: "$name" } },
          },
        },
      },
    },
  ]);
});

test("serializes a resource tree inside a split pane", () => {
  const databases = defineResource({ id: "databases", query: () => [] });
  expect(
    serializeNodes(
      SplitPane({
        sidebar: ResourceTree({
          label: "Data explorer",
          stateKey: "duckdb-data",
          selectedPath: "/data/memory",
          branch: {
            source: databases(),
            typeField: "type",
            rowLink: {
              path: "/data/:database",
              params: { database: "name" },
            },
          },
        }),
        content: PageHeader({ title: "memory" }),
      }),
    ),
  ).toEqual([
    {
      kind: "split-pane",
      props: {
        sidebar: [
          {
            kind: "resource-tree",
            props: {
              label: "Data explorer",
              stateKey: "duckdb-data",
              selectedPath: "/data/memory",
              branch: {
                source: { resourceId: "databases" },
                typeField: "type",
                rowLink: {
                  path: "/data/:database",
                  params: { database: "name" },
                },
              },
            },
          },
        ],
        content: [{ kind: "page-header", props: { title: "memory" } }],
      },
    },
  ]);
});
test("serializes an optional inspector using the existing node boundary", () => {
  const node = SplitPane({
    sidebar: PageHeader({ title: "Explorer" }),
    content: PageHeader({ title: "orders" }),
    inspector: PageHeader({ title: "Table details" }),
  });
  expect(serializeNodes(node)[0]).toMatchObject({
    props: {
      inspector: [{ kind: "page-header", props: { title: "Table details" } }],
    },
  });
});
