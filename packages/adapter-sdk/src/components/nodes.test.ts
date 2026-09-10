import { expect, test } from "bun:test";
import { z } from "zod";
import { defineAction } from "../action/index";
import { defineResource } from "../resource/index";
import {
  ActionList,
  Button,
  CardList,
  Columns,
  Form,
  Meter,
  PageHeader,
  ResourceTree,
  Section,
  SplitPane,
  StatGrid,
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

test("StatGrid requires items with fields", () => {
  const stats = defineResource({ id: "stats", query: () => [] });
  const node = StatGrid({
    source: stats(),
    items: [{ icon: "database", field: "size", label: "Database size" }],
  });
  expect(node.kind).toBe("stat-grid");
  expect(node.props.items).toHaveLength(1);
  expect(() => StatGrid({ items: [] })).toThrow();
  expect(() => StatGrid({ items: [{ field: "", label: "Empty" }] })).toThrow();
});

test("Section requires a title and an absolute link", () => {
  const node = Section({
    title: "Recent tables",
    description: "Recently accessed tables.",
    link: { label: "View all", path: "/data" },
    content: PageHeader({ title: "Tables" }),
  });
  expect(node.kind).toBe("section");
  expect(() =>
    Section({ title: "", content: PageHeader({ title: "x" }) }),
  ).toThrow();
  expect(() =>
    Section({
      title: "Bad",
      link: { label: "x", path: "relative" },
      content: PageHeader({ title: "x" }),
    }),
  ).toThrow();
});

test("CardList rejects relative card links", () => {
  const node = CardList({
    cards: [
      {
        title: "main",
        badge: "Primary",
        meta: ["4 schemas"],
        link: { path: "/data/memory", params: {} },
      },
    ],
  });
  expect(node.kind).toBe("card-list");
  expect(() =>
    CardList({
      cards: [{ title: "bad", link: { path: "nope", params: {} } }],
    }),
  ).toThrow();
});

test("ActionList requires titled items with absolute links", () => {
  const node = ActionList({
    items: [
      { icon: "play", title: "New query", link: "/query", kbd: "⌘N" },
      { title: "Attach", action: "attach-database" },
    ],
  });
  expect(node.kind).toBe("action-list");
  expect(() => ActionList({ items: [] })).toThrow();
  expect(() => ActionList({ items: [{ title: "" }] })).toThrow();
  expect(() =>
    ActionList({ items: [{ title: "Bad", link: "relative" }] }),
  ).toThrow();
});

test("Button and PageHeader accept absolute links and badges", () => {
  const node = PageHeader({
    title: "DuckDB",
    description: "Fast analytics.",
    badge: { label: "Connected", tone: "healthy" },
    meta: "~/data/demo.duckdb",
    actions: [
      Button({ label: "New query", variant: "primary", link: "/query" }),
    ],
  });
  expect(node.props.badge).toEqual({ label: "Connected", tone: "healthy" });
  expect(node.props.actions).toHaveLength(1);
  expect(() => Button({ label: "Bad", link: "relative" })).toThrow();
});

test("Columns requires at least one column", () => {
  const node = Columns({
    columns: [
      { weight: 2, content: PageHeader({ title: "A" }) },
      { content: PageHeader({ title: "B" }) },
    ],
  });
  expect(node.kind).toBe("columns");
  expect(node.props.columns).toHaveLength(2);
  expect(() => Columns({ columns: [] })).toThrow();
});

test("CardList columns stay within 1 and 4", () => {
  expect(CardList({ columns: 2 }).props.columns).toBe(2);
  expect(() => CardList({ columns: 0 })).toThrow();
  expect(() => CardList({ columns: 5 })).toThrow();
  expect(() => CardList({ columns: 1.5 })).toThrow();
});

test("Meter requires labeled segments with finite values", () => {
  const node = Meter({
    data: {
      segments: [{ label: "Database file", value: 1024, tone: "info" }],
      footer: "1 GB free",
    },
  });
  expect(node.kind).toBe("meter");
  expect(() => Meter({ data: { segments: [] } })).toThrow();
  expect(() =>
    Meter({ data: { segments: [{ label: "", value: 1 }] } }),
  ).toThrow();
  expect(() =>
    Meter({ data: { segments: [{ label: "x", value: Number.NaN }] } }),
  ).toThrow();
  expect(() =>
    Meter({ data: { segments: [{ label: "x", value: -1 }] } }),
  ).toThrow();
});
