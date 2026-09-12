import {
  DeclarativePageRenderer,
  type RendererClient,
} from "@northgraindata/dsui-renderer";
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  CodeEditor,
  Collection,
  Columns,
  Flex,
  Form,
  type FormProps,
  Grid,
  Icon,
  KeyValue,
  Link,
  Meter,
  PageHeader,
  type PageNode,
  QueryEditor,
  Resource,
  ResourceTree,
  Section,
  Select,
  SplitPane,
  Stack,
  Table,
  Tabs,
  TextInput,
  Value,
} from "../../../../../packages/adapter-sdk/src/components";

const previewSource = (resourceId: string) =>
  ({
    kind: "resource-binding",
    resourceId,
    input: undefined,
  }) as const;

const previewAction = {
  kind: "action-binding",
  actionId: "catalog-action",
  input: {},
} as const;

const previewSchema = {} as FormProps["schema"];

const examples: Record<string, readonly PageNode[]> = {
  badge: [Badge({ label: "Healthy", tone: "healthy", dot: true })],
  button: [
    Flex({
      content: [
        Button({
          label: "Run query",
          variant: "primary",
          action: previewAction,
        }),
        Button({
          label: "View details",
          variant: "secondary",
          link: "/details",
        }),
      ],
      gap: "sm",
      wrap: true,
    }),
  ],
  card: [
    Card({
      title: "Analytics warehouse",
      description: "Ready for interactive queries",
      icon: "database",
      badge: "Healthy",
      badgeTone: "healthy",
      variant: "interactive",
    }),
  ],
  "code-block": [
    CodeBlock({
      label: "Query",
      language: "sql",
      value: "SELECT *\nFROM analytics.events\nLIMIT 100;",
    }),
  ],
  "code-editor": [
    CodeEditor({
      language: "sql",
      value: "SELECT count(*) FROM events;",
    }),
  ],
  collection: [
    Collection({
      source: previewSource("service-list"),
      content: Card({
        title: { field: "name" },
        description: { field: "endpoint" },
        variant: "subtle",
      }),
    }),
  ],
  columns: [
    Columns({
      columns: [
        {
          content: Card({
            title: "Schemas",
            content: Badge({ label: "24", tone: "info" }),
          }),
        },
        {
          content: Card({
            title: "Tables",
            content: Badge({ label: "182", tone: "muted" }),
          }),
        },
      ],
    }),
  ],
  flex: [
    Flex({
      content: [
        Badge({ label: "Trino", tone: "info" }),
        Badge({ label: "Connected", tone: "healthy", dot: true }),
      ],
      align: "center",
      gap: "sm",
      wrap: true,
    }),
  ],
  form: [
    Form({
      schema: previewSchema,
      fields: [
        TextInput({ name: "endpoint", label: "Endpoint", value: "trino:8080" }),
        Select({
          name: "mode",
          label: "Mode",
          value: "read-only",
          options: [
            { label: "Read only", value: "read-only" },
            { label: "Read and write", value: "read-write" },
          ],
        }),
      ],
      onSubmit: previewAction,
      submitLabel: "Test connection",
    }),
  ],
  grid: [
    Grid({
      columns: 2,
      gap: "sm",
      content: [
        Card({ title: "Trino", description: "trino:8080", variant: "subtle" }),
        Card({ title: "Kafka", description: "kafka:9092", variant: "subtle" }),
      ],
    }),
  ],
  icon: [
    Flex({
      content: [
        Icon({ name: "database", size: 24 }),
        Icon({ name: "search", size: 24 }),
      ],
      align: "center",
      gap: "md",
    }),
  ],
  "key-value": [
    KeyValue({
      title: "Connection",
      data: { Status: "Healthy", Endpoint: "trino:8080", Catalogs: 4 },
    }),
  ],
  link: [
    Link({
      href: "/docs/adapters",
      label: "Explore adapters",
      icon: "arrow-right",
    }),
  ],
  meter: [
    Meter({
      data: {
        segments: [
          { label: "Used", value: 68, tone: "info", legend: true },
          { label: "Free", value: 32, tone: "deep", legend: true },
        ],
        footer: "68 GB of 100 GB used",
      },
    }),
  ],
  "page-header": [
    PageHeader({
      title: "Production Trino",
      description: "Shared query engine",
      icon: "database",
      badge: { label: "Healthy", tone: "healthy" },
      meta: "trino:8080",
      variant: "detail",
      actions: Button({ label: "Open", variant: "primary", link: "/open" }),
    }),
  ],
  "query-editor": [
    QueryEditor({
      language: "sql",
      value: "SELECT *\nFROM analytics.events\nLIMIT 100;",
      action: "run-query",
    }),
  ],
  resource: [
    Resource({
      source: previewSource("service-detail"),
      content: KeyValue({ title: "Service", data: { Status: "Healthy" } }),
    }),
  ],
  "resource-tree": [
    ResourceTree({
      label: "Catalog explorer",
      branch: {
        source: previewSource("resource-tree"),
        nameField: "name",
        typeField: "type",
      },
      searchPlaceholder: "Search resources…",
    }),
  ],
  section: [
    Section({
      title: "Recent queries",
      description: "Queries executed from this connection.",
      link: { label: "View all", path: "/queries" },
      content: Table({
        data: [{ query: "SELECT count(*) FROM events", duration: "84 ms" }],
        columns: [
          { id: "query", label: "Query" },
          { id: "duration", label: "Duration" },
        ],
      }),
    }),
  ],
  select: [
    Select({
      name: "catalog",
      label: "Catalog",
      value: "analytics",
      options: [
        { label: "Analytics", value: "analytics" },
        { label: "Raw", value: "raw" },
      ],
    }),
  ],
  "split-pane": [
    SplitPane({
      sidebar: Card({
        title: "Explorer",
        description: "Schemas and tables",
        variant: "panel",
      }),
      content: CodeBlock({
        label: "Query",
        value: "SELECT 1;",
        language: "sql",
      }),
      inspector: KeyValue({ data: { Rows: 1, Duration: "12 ms" } }),
    }),
  ],
  stack: [
    Stack({
      content: [
        Badge({ label: "First", tone: "info" }),
        Badge({ label: "Second", tone: "muted" }),
      ],
      gap: "sm",
    }),
  ],
  table: [
    Table({
      data: [
        { service: "Trino", endpoint: "trino:8080", status: "Healthy" },
        { service: "Kafka", endpoint: "kafka:9092", status: "Healthy" },
      ],
      columns: [
        { id: "service", label: "Service" },
        { id: "endpoint", label: "Endpoint" },
        { id: "status", label: "Status" },
      ],
    }),
  ],
  tabs: [
    Tabs({
      items: [
        {
          label: "Overview",
          content: KeyValue({ data: { Status: "Healthy" } }),
        },
        {
          label: "Configuration",
          content: CodeBlock({ label: "Endpoint", value: "trino:8080" }),
        },
      ],
    }),
  ],
  "text-input": [
    TextInput({
      name: "endpoint",
      label: "Endpoint",
      value: "trino:8080",
      placeholder: "host:port",
    }),
  ],
  value: [Value({ field: "size", format: "bytes", fallback: "48.2 GB" })],
};

const client: RendererClient = {
  async executeResource(reference) {
    if (reference.resourceId === "service-list") {
      return [
        { name: "Trino", endpoint: "trino:8080" },
        { name: "Kafka", endpoint: "kafka:9092" },
      ];
    }
    if (reference.resourceId === "resource-tree") {
      return [
        { name: "analytics", type: "schema" },
        { name: "events", type: "table" },
      ];
    }
    return {
      name: "Production Trino",
      status: "Healthy",
      size: 51_754_876_928,
    };
  },
  async executeAction() {
    return { status: "success", data: [] };
  },
  navigate() {},
};

export default function PrimitivePreview({ id }: { id: string }) {
  const nodes = examples[id];
  if (!nodes)
    return (
      <p className="primitive-preview-unavailable">Preview unavailable.</p>
    );
  return <DeclarativePageRenderer client={client} nodes={nodes} />;
}
