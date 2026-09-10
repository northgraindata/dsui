import { expect, test } from "bun:test";
import { z } from "zod";
import { defineResource } from "../resource/index";
import {
  ActionList,
  Button,
  CardList,
  Columns,
  Meter,
  PageHeader,
  QueryEditor,
  ResourceTree,
  Section,
  SplitPane,
  StatGrid,
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

test("serializes a browser-owned query editor", () => {
  const runQuery = { kind: "action", id: "run-query" } as const;
  const databases = defineResource({ id: "databases", query: () => [] });
  const schemas = defineResource({
    id: "schemas",
    input: z.object({ database: z.string() }),
    query: () => [],
  });
  expect(
    serializeNodes(
      QueryEditor({
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
      kind: "query-editor",
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

test("serializes page header badge, meta, and actions", () => {
  expect(
    serializeNodes([
      PageHeader({
        title: "DuckDB",
        description: "Fast analytics.",
        badge: { label: "Connected", tone: "healthy" },
        meta: "~/data/demo.duckdb",
        actions: [
          Button({ label: "New query", variant: "primary", link: "/query" }),
        ],
      }),
    ]),
  ).toEqual([
    {
      kind: "page-header",
      props: {
        title: "DuckDB",
        description: "Fast analytics.",
        badge: { label: "Connected", tone: "healthy" },
        meta: "~/data/demo.duckdb",
        actions: [{ label: "New query", variant: "primary", link: "/query" }],
      },
    },
  ]);
});

test("serializes overview nodes with sources and static content", () => {
  const stats = defineResource({ id: "stats", query: () => [] });
  const databases = defineResource({ id: "databases", query: () => [] });
  expect(
    serializeNodes([
      StatGrid({
        source: stats(),
        items: [{ icon: "database", field: "size", label: "Size" }],
      }),
      Section({
        title: "Recent tables",
        link: { label: "View all", path: "/data" },
        content: Table({ source: databases() }),
      }),
      CardList({
        cards: [
          {
            title: "main",
            badge: "Primary",
            meta: ["4 schemas"],
            link: { path: "/data/:database", params: { database: "name" } },
          },
        ],
      }),
      ActionList({
        items: [
          { icon: "play", title: "New query", link: "/query", kbd: "⌘N" },
          { title: "Attach", action: "attach-database" },
        ],
      }),
    ]),
  ).toEqual([
    {
      kind: "stat-grid",
      props: {
        source: { resourceId: "stats" },
        items: [{ icon: "database", field: "size", label: "Size" }],
      },
    },
    {
      kind: "section",
      props: {
        title: "Recent tables",
        link: { label: "View all", path: "/data" },
        content: [
          { kind: "table", props: { source: { resourceId: "databases" } } },
        ],
      },
    },
    {
      kind: "card-list",
      props: {
        cards: [
          {
            title: "main",
            badge: "Primary",
            meta: ["4 schemas"],
            link: { path: "/data/:database", params: { database: "name" } },
          },
        ],
      },
    },
    {
      kind: "action-list",
      props: {
        items: [
          { icon: "play", title: "New query", link: "/query", kbd: "⌘N" },
          { title: "Attach", action: { actionId: "attach-database" } },
        ],
      },
    },
  ]);
});

test("serializes columns with weights and nested content", () => {
  expect(
    serializeNodes([
      Columns({
        columns: [
          { weight: 2, content: PageHeader({ title: "A" }) },
          { content: PageHeader({ title: "B" }) },
        ],
      }),
    ]),
  ).toEqual([
    {
      kind: "columns",
      props: {
        columns: [
          {
            weight: 2,
            content: [{ kind: "page-header", props: { title: "A" } }],
          },
          { content: [{ kind: "page-header", props: { title: "B" } }] },
        ],
      },
    },
  ]);
});

test("serializes card columns and meter data", () => {
  expect(
    serializeNodes([
      CardList({
        columns: 2,
        cards: [{ title: "main", badge: "Primary" }],
      }),
      Meter({
        data: {
          segments: [{ label: "Database file", value: 1024, tone: "info" }],
          footer: "1 GB free",
        },
      }),
    ]),
  ).toEqual([
    {
      kind: "card-list",
      props: {
        columns: 2,
        cards: [{ title: "main", badge: "Primary" }],
      },
    },
    {
      kind: "meter",
      props: {
        data: {
          segments: [{ label: "Database file", value: 1024, tone: "info" }],
          footer: "1 GB free",
        },
      },
    },
  ]);
});
