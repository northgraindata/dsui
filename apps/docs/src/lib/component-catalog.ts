export interface PropDef {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export interface ComponentDoc {
  slug: string;
  name: string;
  description: string;
  props: PropDef[];
  example: string;
}

export const components: ComponentDoc[] = [
  {
    slug: "grid",
    name: "Grid",
    description: "CSS grid with 1-6 columns.",
    props: [
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Child nodes",
      },
      {
        name: "columns",
        type: "1 | 2 | 3 | 4 | 5 | 6",
        default: "1",
        description: "Number of grid columns",
      },
      {
        name: "gap",
        type: '"none" | "sm" | "md" | "lg"',
        default: '"md"',
        description: "Spacing between items",
      },
    ],
    example: `Grid({
  columns: 3,
  gap: "md",
  content: [
    Card({ title: "One" }),
    Card({ title: "Two" }),
    Card({ title: "Three" }),
  ],
})`,
  },
  {
    slug: "columns",
    name: "Columns",
    description: "Multi-column weighted layout.",
    props: [
      {
        name: "columns",
        type: "ColumnsColumn[]",
        description:
          "Column definitions. Each has `weight?` (relative width) and `content`.",
      },
    ],
    example: `Columns({
  columns: [
    { weight: 2, content: Table({ source: left() }) },
    { weight: 1, content: Card({ content: Value({ source: right(), field: "x" }) }) },
  ],
})`,
  },
  {
    slug: "flex",
    name: "Flex",
    description: "Flexbox row or column layout.",
    props: [
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Child nodes",
      },
      {
        name: "direction",
        type: '"row" | "column"',
        default: '"row"',
        description: "Flex direction",
      },
      {
        name: "gap",
        type: '"none" | "sm" | "md" | "lg"',
        default: '"md"',
        description: "Spacing between items",
      },
      {
        name: "align",
        type: '"start" | "center" | "end" | "stretch"',
        default: '"stretch"',
        description: "Cross-axis alignment",
      },
      {
        name: "justify",
        type: '"start" | "center" | "end" | "between"',
        default: '"start"',
        description: "Main-axis alignment",
      },
      {
        name: "wrap",
        type: "boolean",
        default: "false",
        description: "Allow wrapping",
      },
    ],
    example: `Flex({
  direction: "row",
  gap: "sm",
  align: "center",
  justify: "between",
  content: [
    Badge({ label: "Status" }),
    Button({ label: "Action" }),
  ],
})`,
  },
  {
    slug: "stack",
    name: "Stack",
    description: "Vertical stack with gap.",
    props: [
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Child nodes",
      },
      {
        name: "gap",
        type: '"none" | "sm" | "md" | "lg"',
        default: '"md"',
        description: "Spacing between items",
      },
    ],
    example: `Stack({
  gap: "sm",
  content: [
    Badge({ label: "First" }),
    Badge({ label: "Second" }),
    Badge({ label: "Third" }),
  ],
})`,
  },
  {
    slug: "split-pane",
    name: "SplitPane",
    description: "Sidebar + content + inspector layout.",
    props: [
      {
        name: "sidebar",
        type: "PageNode | PageNode[]",
        description: "Left pane",
      },
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Center pane",
      },
      {
        name: "inspector",
        type: "PageNode | PageNode[]",
        description: "Right pane (optional)",
      },
    ],
    example: `SplitPane({
  sidebar: ResourceTree({ label: "Explorer", branch: { source: tree() } }),
  content: Table({ source: selected() }),
  inspector: Card({ content: Value({ source: detail(), field: "info" }) }),
})`,
  },
  {
    slug: "table",
    name: "Table",
    description: "Data table with rows, actions, and filters.",
    props: [
      {
        name: "source",
        type: "DataSource",
        description: "Resource binding to fetch rows from",
      },
      {
        name: "data",
        type: "Record<string, unknown>[]",
        description: "Inline data (alternative to `source`)",
      },
      {
        name: "columns",
        type: "TableColumn[]",
        description: "Column definitions",
      },
      {
        name: "variant",
        type: '"default" | "data"',
        description: "Visual style",
      },
      {
        name: "rowLink",
        type: "{ path, params }",
        description: "Link each row to a route",
      },
      {
        name: "rowActions",
        type: "TableRowAction[]",
        description: "Per-row action buttons",
      },
      {
        name: "actions",
        type: "TableRowMenuAction[]",
        description: "Table-level menu actions",
      },
      { name: "searchable", type: "boolean", description: "Show search input" },
      {
        name: "filters",
        type: "TableFilter[]",
        description: "Column filter dropdowns",
      },
      { name: "pageSize", type: "number", description: "Rows per page" },
    ],
    example: `Table({
  source: warehouses(),
  columns: [
    { id: "name", label: "Name" },
    { id: "status", label: "Status" },
  ],
  rowActions: [
    {
      label: "Suspend",
      action: suspendWarehouse({ warehouse: "row.name" }),
      when: { field: "status", equals: "RUNNING" },
    },
  ],
  searchable: true,
})`,
  },
  {
    slug: "value",
    name: "Value",
    description: "Single field from a data source.",
    props: [
      { name: "source", type: "DataSource", description: "Resource binding" },
      { name: "field", type: "string", description: "Field name to extract" },
      {
        name: "format",
        type: '"text" | "number" | "bytes"',
        default: '"text"',
        description: "Display format",
      },
      {
        name: "fallback",
        type: "string",
        description: "Shown when value is missing",
      },
    ],
    example: `Value({ source: status(), field: "url" })
Value({ source: metrics(), field: "bytes", format: "bytes", fallback: "N/A" })`,
  },
  {
    slug: "key-value",
    name: "KeyValue",
    description: "Key-value pairs from a resource or inline data.",
    props: [
      { name: "source", type: "DataSource", description: "Resource binding" },
      {
        name: "data",
        type: "Record<string, unknown>",
        description: "Inline data (alternative to `source`)",
      },
      { name: "title", type: "string", description: "Heading text" },
    ],
    example: `KeyValue({ source: config(), title: "Configuration" })
KeyValue({ data: { host: "localhost", port: 5432 }, title: "Connection" })`,
  },
  {
    slug: "meter",
    name: "Meter",
    description: "Horizontal bar chart with segments.",
    props: [
      { name: "source", type: "DataSource", description: "Resource binding" },
      {
        name: "data",
        type: "{ segments, footer? }",
        description: "Inline meter data",
      },
    ],
    example: `Meter({
  source: usage(),
  data: {
    segments: [
      { label: "Used", value: 72, tone: "warning" },
      { label: "Free", value: 28, tone: "healthy" },
    ],
    footer: "72% utilized",
  },
})`,
  },
  {
    slug: "badge",
    name: "Badge",
    description: "Status indicator with label and tone.",
    props: [
      {
        name: "label",
        type: "string | FieldReference",
        description: "Badge text",
      },
      {
        name: "tone",
        type: '"healthy" | "warning" | "unavailable" | "info" | "muted"',
        default: '"info"',
        description: "Color tone",
      },
      {
        name: "dot",
        type: "boolean",
        default: "false",
        description: "Show a colored dot",
      },
    ],
    example: `Badge({ label: "Healthy", tone: "healthy", dot: true })
Badge({ label: row.status })`,
  },
  {
    slug: "icon",
    name: "Icon",
    description: "Named icon renderer.",
    props: [
      {
        name: "name",
        type: "string | FieldReference",
        description: "Icon name",
      },
      { name: "size", type: "number", description: "Size in pixels" },
    ],
    example: `Icon({ name: "database", size: 16 })
Icon({ name: row.icon })`,
  },
  {
    slug: "collection",
    name: "Collection",
    description: "Iterate over a data source.",
    props: [
      {
        name: "source",
        type: "DataSource",
        description: "Resource binding to iterate over",
      },
      {
        name: "field",
        type: "string",
        description: "Field name to iterate over",
      },
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Template rendered per item",
      },
    ],
    example: `Collection({
  source: items(),
  content: Card({ content: Value({ field: "name" }) }),
})`,
  },
  {
    slug: "resource-tree",
    name: "ResourceTree",
    description: "Hierarchical tree navigator.",
    props: [
      { name: "label", type: "string", description: "Tree label" },
      {
        name: "branch",
        type: "ResourceTreeBranchProps",
        description: "Root branch definition",
      },
      {
        name: "selectedPath",
        type: "string",
        description: "Currently selected path",
      },
      {
        name: "stateKey",
        type: "string",
        description: "Persistence key for selection state",
      },
      {
        name: "searchPlaceholder",
        type: "string",
        description: "Search input placeholder",
      },
    ],
    example: `ResourceTree({
  label: "Explorer",
  branch: {
    source: tree(),
    nameField: "name",
    rowLink: { path: "/item/:id", params: { id: "id" } },
    children: { source: children(), nameField: "name" },
  },
})`,
  },
  {
    slug: "card",
    name: "Card",
    description: "Versatile container with title, badge, and link.",
    props: [
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Child nodes",
      },
      {
        name: "title",
        type: "string | FieldReference",
        description: "Card heading",
      },
      {
        name: "description",
        type: "string | FieldReference",
        description: "Subtext",
      },
      {
        name: "icon",
        type: "string | FieldReference",
        description: "Icon name",
      },
      {
        name: "badge",
        type: "string | FieldReference",
        description: "Badge label",
      },
      {
        name: "badgeTone",
        type: '"healthy" | "warning" | "unavailable" | "info"',
        default: '"info"',
        description: "Badge color",
      },
      { name: "link", type: "TableRowLink", description: "Navigate on click" },
      {
        name: "variant",
        type: '"default" | "subtle" | "metric" | "interactive" | "panel"',
        default: '"default"',
        description: "Visual style",
      },
    ],
    example: `Card({
  title: "Status",
  content: Value({ source: status(), field: "ok" }),
  variant: "metric",
  badge: { label: "Healthy", tone: "healthy" },
})`,
  },
  {
    slug: "section",
    name: "Section",
    description: "Titled content block.",
    props: [
      { name: "title", type: "string", description: "Section heading" },
      { name: "description", type: "string", description: "Subtext" },
      {
        name: "link",
        type: "{ label: string; path: string }",
        description: '"See all" link (path must start with `/`)',
      },
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Child nodes",
      },
    ],
    example: `Section({
  title: "Warehouses",
  description: "Active compute resources",
  link: { label: "View all", path: "/warehouses" },
  content: Table({ source: warehouses() }),
})`,
  },
  {
    slug: "page-header",
    name: "PageHeader",
    description: "Page-level header with title, badge, and actions.",
    props: [
      {
        name: "title",
        type: "string | FieldReference",
        description: "Page title",
      },
      {
        name: "description",
        type: "string | FieldReference",
        description: "Subtitle",
      },
      {
        name: "icon",
        type: "string | FieldReference",
        description: "Icon name",
      },
      { name: "badge", type: "{ label, tone? }", description: "Status badge" },
      {
        name: "meta",
        type: "string | FieldReference",
        description: "Metadata text",
      },
      {
        name: "variant",
        type: '"default" | "detail"',
        default: '"default"',
        description: "Visual style",
      },
      {
        name: "tags",
        type: "PageNode | PageNode[]",
        description: "Tag slot (badges, etc.)",
      },
      {
        name: "actions",
        type: "PageNode | PageNode[]",
        description: "Action buttons",
      },
    ],
    example: `PageHeader({
  title: "Warehouses",
  description: "Manage compute resources",
  badge: { label: "5 active", tone: "healthy" },
  actions: [Button({ label: "Refresh", action: flush() })],
})`,
  },
  {
    slug: "tabs",
    name: "Tabs",
    description: "Tabbed interface.",
    props: [
      { name: "items", type: "TabsItem[]", description: "Tab definitions" },
      {
        name: "defaultIndex",
        type: "number",
        default: "0",
        description: "Initially active tab",
      },
      {
        name: "variant",
        type: '"default" | "detail"',
        default: '"default"',
        description: "Visual style",
      },
    ],
    example: `Tabs({
  items: [
    { label: "Overview", content: Table({ source: overview() }) },
    { label: "Metrics", content: Card({ content: Value({ source: metrics(), field: "cpu" }) }) },
    { label: "Logs", link: "/logs" },
  ],
})`,
  },
  {
    slug: "resource",
    name: "Resource",
    description: "Data-binding wrapper.",
    props: [
      { name: "source", type: "DataSource", description: "Resource binding" },
      {
        name: "content",
        type: "PageNode | PageNode[]",
        description: "Child nodes",
      },
    ],
    example: `Resource({
  source: config(),
  content: [Value({ field: "host" }), Value({ field: "port" })],
})`,
  },
  {
    slug: "button",
    name: "Button",
    description: "Clickable action trigger.",
    props: [
      {
        name: "label",
        type: "string | FieldReference",
        description: "Button text",
      },
      {
        name: "action",
        type: "ActionTarget | FieldReference",
        description: "Action to execute on click",
      },
      {
        name: "link",
        type: "string | FieldReference",
        description: "URL to navigate to",
      },
      {
        name: "icon",
        type: "string | FieldReference",
        description: "Icon name",
      },
      {
        name: "description",
        type: "string | FieldReference",
        description: "Tooltip text",
      },
      {
        name: "kbd",
        type: "string | FieldReference",
        description: "Keyboard shortcut hint",
      },
      {
        name: "variant",
        type: '"primary" | "secondary" | "danger" | "list-item"',
        default: '"secondary"',
        description: "Visual style",
      },
      {
        name: "confirmation",
        type: "{ title, description, confirmLabel? }",
        description: "Confirmation dialog before execution",
      },
      {
        name: "successLink",
        type: "TableRowLink",
        description: "Navigate after success",
      },
    ],
    example: `Button({ label: "Submit", action: save(), variant: "primary" })

Button({
  label: "Delete",
  action: deleteItem({ id: row.id }),
  variant: "danger",
  confirmation: { title: "Delete item?", description: "This cannot be undone." },
})`,
  },
  {
    slug: "form",
    name: "Form",
    description: "Zod-driven form.",
    props: [
      {
        name: "schema",
        type: "z.ZodTypeAny",
        description: "Zod schema defining form fields",
      },
      {
        name: "fields",
        type: "PageNode[]",
        description: "Optional custom field nodes",
      },
      {
        name: "onSubmit",
        type: "ActionTarget",
        description: "Action triggered on form submission",
      },
      {
        name: "submitLabel",
        type: "string",
        description: "Submit button text",
      },
    ],
    example: `Form({
  schema: z.object({ name: z.string().min(1), endpoint: z.string().url() }),
  onSubmit: createConnection(),
  submitLabel: "Connect",
})`,
  },
  {
    slug: "select",
    name: "Select",
    description: "Dropdown input.",
    props: [
      { name: "name", type: "string", description: "Field name" },
      { name: "label", type: "string", description: "Label text" },
      {
        name: "options",
        type: "{ label: string; value: string }[]",
        description: "Available options",
      },
      {
        name: "value",
        type: "string | null",
        description: "Currently selected value",
      },
      {
        name: "onChange",
        type: "(value: string | null) => void",
        description: "Change callback (browser only)",
      },
      { name: "placeholder", type: "string", description: "Placeholder text" },
    ],
    example: `Select({
  name: "warehouse",
  label: "Warehouse",
  options: [
    { label: "Small", value: "SMALL" },
    { label: "Medium", value: "MEDIUM" },
    { label: "Large", value: "LARGE" },
  ],
  value: "MEDIUM",
})`,
  },
  {
    slug: "text-input",
    name: "TextInput",
    description: "Text input field.",
    props: [
      { name: "name", type: "string", description: "Field name" },
      { name: "label", type: "string", description: "Label text" },
      { name: "value", type: "string", description: "Controlled value" },
      {
        name: "onChange",
        type: "(value: string) => void",
        description: "Change callback (browser only)",
      },
      { name: "placeholder", type: "string", description: "Placeholder text" },
      {
        name: "secret",
        type: "boolean",
        description: "Mask input (password field)",
      },
    ],
    example: `TextInput({ name: "host", label: "Host", placeholder: "localhost" })
TextInput({ name: "token", label: "Token", secret: true })`,
  },
  {
    slug: "code-block",
    name: "CodeBlock",
    description: "Read-only syntax-highlighted code.",
    props: [
      {
        name: "label",
        type: "string | FieldReference",
        description: "Block label",
      },
      {
        name: "value",
        type: "string | FieldReference",
        description: "Code content",
      },
      {
        name: "language",
        type: '"python" | "sql" | "text"',
        default: '"text"',
        description: "Syntax language",
      },
    ],
    example: `CodeBlock({
  label: "Query",
  value: "SELECT * FROM orders WHERE total > 100",
  language: "sql",
})`,
  },
  {
    slug: "code-editor",
    name: "CodeEditor",
    description: "Editable code editor (browser only).",
    props: [
      { name: "language", type: "string", description: "Syntax language" },
      { name: "value", type: "string", description: "Current content" },
      {
        name: "onChange",
        type: "(value: string) => void",
        description: "Edit callback",
      },
    ],
    example: `CodeEditor({ language: "sql", value: query, onChange: setQuery })`,
  },
  {
    slug: "query-editor",
    name: "QueryEditor",
    description: "Query editor with explorer sidebar.",
    props: [
      { name: "language", type: "string", description: "Syntax language" },
      { name: "value", type: "string", description: "Initial query text" },
      {
        name: "action",
        type: "AnyActionDefinition | string",
        description: "Action to execute the query",
      },
      {
        name: "explorer",
        type: "{ source, nameField?, children? }",
        description: "Tree explorer sidebar",
      },
    ],
    example: `QueryEditor({
  language: "sql",
  value: "SELECT 1",
  action: executeQuery(),
  explorer: { source: tree(), nameField: "name" },
})`,
  },
  {
    slug: "notebook",
    name: "Notebook",
    description: "Full notebook with markdown and code blocks.",
    props: [
      { name: "title", type: "string", description: "Notebook title" },
      { name: "description", type: "string", description: "Subtitle" },
      {
        name: "blocks",
        type: "NotebookBlock[]",
        description: "Content blocks",
      },
      {
        name: "notebooks",
        type: "{ id, title }[]",
        description: "Notebook list sidebar",
      },
      {
        name: "openTabs",
        type: "{ id, title }[]",
        description: "Open tab indicators",
      },
      {
        name: "metadata",
        type: "{ environment?, location?, updatedAt?, lastViewedAt? }",
        description: "Metadata display",
      },
      {
        name: "actions",
        type: "{ save?, create?, delete?, duplicate?, import?, close?, select? }",
        description: "Lifecycle actions",
      },
    ],
    example: `Notebook({
  title: "Analysis",
  blocks: [
    { id: "b1", kind: "markdown", content: "# Revenue Analysis" },
    { id: "b2", kind: "code", language: "sql", content: "SELECT 1", action: run() },
  ],
  actions: { save: saveNotebook(), create: createNotebook() },
})`,
  },
  {
    slug: "notebook-catalog",
    name: "NotebookCatalog",
    description: "Notebook listing view.",
    props: [
      {
        name: "notebooks",
        type: "NotebookCatalogItem[]",
        description: "List of notebooks",
      },
      {
        name: "actions",
        type: "{ create?, import? }",
        description: "Catalog actions",
      },
    ],
    example: `NotebookCatalog({
  notebooks: [
    { id: "n1", title: "Revenue Analysis", updatedAt: "2025-01-15" },
    { id: "n2", title: "User Segments", updatedAt: "2025-01-14" },
  ],
  actions: { create: createNotebook(), import: importNotebook() },
})`,
  },
  {
    slug: "link",
    name: "Link",
    description: "Navigational link.",
    props: [
      {
        name: "href",
        type: "string | FieldReference",
        description: "Target URL or route",
      },
      {
        name: "label",
        type: "string | FieldReference",
        description: "Link text",
      },
      {
        name: "icon",
        type: "string | FieldReference",
        description: "Icon name",
      },
      { name: "external", type: "boolean", description: "Open in new tab" },
    ],
    example: `Link({ href: "/warehouses", label: "View warehouses" })
Link({ href: "https://docs.example.com", label: "Docs", external: true })`,
  },
];

export function getComponentBySlug(slug: string): ComponentDoc | undefined {
  return components.find((c) => c.slug === slug);
}
