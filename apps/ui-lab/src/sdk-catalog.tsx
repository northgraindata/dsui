import {
  Badge,
  Button,
  Card,
  Chart,
  CodeBlock,
  CodeExplorer,
  Collection,
  Columns,
  Flex,
  Form,
  Gauge,
  Grid,
  Icon,
  KeyValue,
  Link,
  List,
  Meter,
  Notebook,
  NotebookCatalog,
  PageHeader,
  QueryEditor,
  Resource,
  ResourceTree,
  Section,
  Select,
  SplitPane,
  Stack,
  Table,
  Tabs,
  Target,
  TextInput,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { z } from "zod";
import type { CatalogEntry } from "./catalog-types";
import { columns, dataRows, points, source } from "./fixtures";
import { block, bound, detail } from "./sdk-examples";

export const sdkCatalog: CatalogEntry[] = [
  block(
    "badge",
    Object.fromEntries(
      (["healthy", "warning", "unavailable", "info", "muted"] as const).flatMap(
        (tone) =>
          [false, true].map((dot) => [
            `${tone}${dot ? " · dot" : ""}`,
            () => Badge({ label: tone, tone, dot }),
          ]),
      ),
    ),
  ),
  block(
    "button",
    Object.fromEntries(
      (["primary", "secondary", "danger", "list-item"] as const).map(
        (variant) => [
          variant,
          () =>
            Button({
              label: "Run action",
              variant,
              action: { kind: "action-binding", actionId: "save", input: {} },
            }),
        ],
      ),
    ),
  ),
  block(
    "card",
    Object.fromEntries(
      (["default", "subtle", "metric", "interactive", "panel"] as const).map(
        (variant) => [
          variant,
          () =>
            Card({
              title: "Memory used",
              description: "9.3 GB of 16 GB",
              icon: "activity",
              variant,
              content: Value({ field: "reading", fallback: "58%" }),
              badge: "Healthy",
              badgeTone: "healthy",
            }),
        ],
      ),
    ),
  ),
  bound("chart", () =>
    Chart({
      source: source("series"),
      label: "Memory usage",
      yRange: { min: 0, max: 100, unit: "%" },
    }),
  ),
  block("chart-variants", {
    line: () => Chart({ points, label: "Line" }),
    "area and threshold": () =>
      Chart({
        points,
        kind: "area",
        label: "Area",
        referenceLine: { value: 60, label: "Threshold" },
      }),
    "one point": () =>
      Chart({ points: points.slice(0, 1), label: "Single point" }),
  }),
  block("code-block", {
    SQL: () =>
      CodeBlock({
        label: "Query",
        language: "sql",
        value: "select * from analytics.orders limit 100;",
      }),
    empty: () => CodeBlock({ label: "Empty output", value: "" }),
    long: () => CodeBlock({ label: "Log", value: "long_output_".repeat(60) }),
  }),
  bound("code-explorer", (scenario) =>
    CodeExplorer({
      title: "Repository",
      files:
        scenario === "empty"
          ? []
          : [
              { path: "models/orders.sql", size: 49 },
              { path: "README.md", size: 128 },
            ],
      path: "models/orders.sql",
      file: { resourceId: "file", input: {} },
      basePath: "/repository",
    }),
  ),
  bound("collection", () =>
    Collection({
      source: source("collection"),
      content: Card({
        title: { field: "name" },
        description: { field: "type" },
      }),
    }),
  ),
  block("columns", {
    equal: () =>
      Columns({ columns: [{ content: detail() }, { content: detail() }] }),
    weighted: () =>
      Columns({
        columns: [
          { weight: 2, content: detail() },
          { weight: 1, content: detail() },
        ],
      }),
  }),
  block("flex", {
    row: () => Flex({ content: [detail(), detail()], gap: "md", wrap: true }),
    column: () =>
      Flex({ content: [detail(), detail()], direction: "column", gap: "sm" }),
  }),
  bound("form", () =>
    Form({
      schema: z.object({ name: z.string() }),
      fields: [
        TextInput({
          name: "name",
          label: "Service name",
          placeholder: "Production",
        }),
        Select({
          name: "adapter",
          label: "Adapter",
          options: [
            { label: "PostgreSQL", value: "postgresql" },
            { label: "ClickHouse", value: "clickhouse" },
          ],
        }),
      ],
      onSubmit: { kind: "action", id: "save" },
      submitLabel: "Save connection",
    }),
  ),
  block(
    "gauge",
    Object.fromEntries(
      [0, 42, 80, 100]
        .map((value) => [
          `${value}%`,
          () => Gauge({ value, label: `Health score ${value}` }),
        ])
        .concat([
          [
            "higher is worse",
            () =>
              Gauge({
                value: 92,
                scale: "higher-is-worse",
                label: "Disk used",
              }),
          ],
        ]),
    ),
  ),
  block("grid", {
    auto: () => Grid({ content: [detail(), detail(), detail()] }),
    "three columns": () =>
      Grid({ columns: 3, gap: "sm", content: [detail(), detail(), detail()] }),
  }),
  block(
    "icon",
    Object.fromEntries(
      [
        "database",
        "activity",
        "cpu",
        "layers",
        "check",
        "warning",
        "close",
        "clock",
        "grid",
      ].map((name) => [name, () => Icon({ name, size: 24 })]),
    ),
  ),
  bound("key-value", () =>
    KeyValue({ source: source("overview"), title: "Runtime" }),
  ),
  block("link", {
    internal: () =>
      Link({
        href: "/services/production",
        label: "Open service",
        icon: "database",
      }),
    long: () =>
      Link({
        href: "/services/production",
        label:
          "Production analytics warehouse with a very long connection name",
      }),
  }),
  bound("list", () =>
    List({
      source: source("tables"),
      item: { title: "name", description: "type", status: { label: "status" } },
      searchable: true,
      pageSize: 5,
      noun: "table",
    }),
  ),
  block("meter", {
    normal: () =>
      Meter({
        data: {
          segments: [
            { label: "Used", value: 72, tone: "info" },
            { label: "Free", value: 28, tone: "muted" },
          ],
          footer: "Primary volume",
        },
      }),
    critical: () =>
      Meter({
        data: {
          segments: [
            { label: "Used", value: 98, tone: "unavailable" },
            { label: "Free", value: 2, tone: "muted" },
          ],
        },
      }),
    zero: () => Meter({ data: { segments: [{ label: "Used", value: 0 }] } }),
  }),
  block("notebook", {
    "markdown and query": () =>
      Notebook({
        id: "lab-notebook",
        title: "Revenue analysis",
        blocks: [
          {
            id: "intro",
            kind: "markdown",
            content: "# Revenue\nInspect daily orders.",
          },
          {
            id: "query",
            kind: "code",
            language: "sql",
            content: "select * from analytics.orders;",
            action: "query",
          },
        ],
      }),
    empty: () => Notebook({ title: "Untitled notebook", blocks: [] }),
  }),
  block("notebook-catalog", {
    normal: () =>
      NotebookCatalog({
        notebooks: [
          {
            id: "revenue",
            title: "Revenue analysis",
            description: "Daily revenue by region",
            environment: "Production",
          },
        ],
      }),
    empty: () => NotebookCatalog({ notebooks: [] }),
  }),
  block("page-header", {
    default: () =>
      PageHeader({
        title: "Analytics",
        description: "Production database",
        icon: "database",
        badge: { label: "Connected", tone: "healthy" },
      }),
    detail: () =>
      PageHeader({
        title: "Analytics",
        description: "Production database",
        icon: "database",
        variant: "detail",
        actions: Button({ label: "Inspect", link: "/inspect" }),
      }),
    long: () =>
      PageHeader({
        title:
          "Production warehouse with a particularly long name and additional context",
        description: "Description ".repeat(24),
      }),
  }),
  bound("query-editor", () =>
    QueryEditor({
      language: "sql",
      value: "select * from analytics.orders limit 100;",
      action: "query",
    }),
  ),
  bound("resource", () =>
    Resource({
      source: source("overview"),
      content: KeyValue({ field: "runtime", title: "Runtime" }),
    }),
  ),
  bound("resource-tree", () =>
    ResourceTree({
      label: "Database",
      branch: {
        source: source("tables"),
        nameField: "name",
        typeField: "type",
      },
      stateKey: "lab-tree",
    }),
  ),
  block("section", {
    default: () =>
      Section({
        title: "Storage",
        description: "Capacity across configured volumes.",
        content: detail(),
      }),
    link: () =>
      Section({
        title: "Services",
        link: { label: "View all", path: "/services" },
        content: detail(),
      }),
  }),
  block("select", {
    selected: () =>
      Select({
        name: "adapter",
        label: "Adapter",
        value: "postgresql",
        options: [
          { label: "PostgreSQL", value: "postgresql" },
          { label: "ClickHouse", value: "clickhouse" },
        ],
      }),
    empty: () => Select({ name: "empty", label: "No adapters", options: [] }),
  }),
  block("split-pane", {
    sidebar: () =>
      SplitPane({ sidebar: Card({ title: "Explorer" }), content: detail() }),
    inspector: () =>
      SplitPane({
        sidebar: Card({ title: "Explorer" }),
        content: detail(),
        inspector: Card({ title: "Properties" }),
      }),
  }),
  block(
    "stack",
    Object.fromEntries(
      (["none", "sm", "md", "lg"] as const).map((gap) => [
        gap,
        () => Stack({ gap, content: [detail(), detail()] }),
      ]),
    ),
  ),
  bound("table", () =>
    Table({
      source: source("tables"),
      columns,
      searchable: true,
      pageSize: 5,
      filters: [
        {
          field: "type",
          label: "Type",
          options: [
            { label: "Table", value: "table" },
            { label: "View", value: "view" },
          ],
        },
      ],
    }),
  ),
  block("table-variants", {
    data: () => Table({ data: dataRows("normal"), columns, variant: "data" }),
    actions: () =>
      Table({
        data: dataRows("normal"),
        columns,
        rowActions: [
          {
            label: "Inspect",
            link: { path: "/tables/:name", params: { name: "name" } },
          },
        ],
      }),
  }),
  block("tabs", {
    default: () =>
      Tabs({
        items: [
          { label: "Overview", content: detail() },
          { label: "Details", content: KeyValue({ data: { Rows: 1842050 } }) },
        ],
      }),
    "second selected": () =>
      Tabs({
        defaultIndex: 1,
        variant: "detail",
        items: [
          { label: "Overview", content: detail() },
          { label: "Details", content: detail() },
        ],
      }),
  }),
  block("target", {
    "overlay target": () => Target({ id: "lab-service", content: detail() }),
  }),
  block("text-input", {
    empty: () =>
      TextInput({ name: "name", label: "Name", placeholder: "Service name" }),
    filled: () => TextInput({ name: "name", value: "Production" }),
    secret: () =>
      TextInput({ name: "password", value: "fixture-only", secret: true }),
  }),
  bound("value", () =>
    Value({
      source: source("overview"),
      field: "reading",
      format: "number",
      fallback: "—",
    }),
  ),
  {
    id: "sdk/code-editor",
    title: "code-editor",
    group: "SDK blocks",
    description:
      "This primitive cannot currently cross the server/browser boundary.",
    source: "packages/adapter-sdk/src/components/primitives/code-editor.ts",
    note: "The production serializer explicitly rejects CodeEditor: it requires a browser-state protocol. Use QueryEditor for the working editor preview. This gap is recorded rather than hidden behind a replacement component.",
    examples: [],
  },
];
