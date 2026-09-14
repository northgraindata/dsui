import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import {
  installExtension,
  loadExtension,
  restartExtension,
} from "../actions/extensions.js";
import type { DuckDbContext, ExtensionInfo } from "../context.js";

const descriptions: Record<
  string,
  { category: string; icon: string; description: string; color?: string }
> = {
  httpfs: {
    category: "Storage",
    icon: "cloud",
    description: "Read and write files from cloud storage and HTTP(S).",
  },
  parquet: {
    category: "File Format",
    icon: "table",
    description: "Read and write Parquet files.",
    color: "cyan",
  },
  json: {
    category: "File Format",
    icon: "braces",
    description: "Read and write JSON files and data.",
    color: "cyan",
  },
  sqlite_scanner: {
    category: "Integration",
    icon: "database",
    description: "Query SQLite databases and files.",
  },
  sqlite: {
    category: "Integration",
    icon: "database",
    description: "Query SQLite databases and files.",
  },
  postgres_scanner: {
    category: "Integration",
    icon: "database",
    description: "Connect to and query PostgreSQL databases.",
  },
  postgres: {
    category: "Integration",
    icon: "database",
    description: "Connect to and query PostgreSQL databases.",
  },
  mysql_scanner: {
    category: "Integration",
    icon: "database",
    description: "Connect to and query MySQL databases.",
  },
  mysql: {
    category: "Integration",
    icon: "database",
    description: "Connect to and query MySQL databases.",
  },
  iceberg: {
    category: "Lakehouse",
    icon: "layers",
    description: "Read and write Apache Iceberg tables.",
    color: "amber",
  },
  delta: {
    category: "Lakehouse",
    icon: "layers",
    description: "Read Delta Lake tables.",
    color: "amber",
  },
  spatial: {
    category: "Analytics",
    icon: "pin",
    description: "Geospatial data types and functions (GEOMETRY, etc).",
    color: "violet",
  },
  fts: {
    category: "Analytics",
    icon: "search",
    description: "Full-text search capabilities.",
    color: "violet",
  },
  vss: {
    category: "Analytics",
    icon: "network",
    description: "Vector similarity search for embeddings.",
    color: "violet",
  },
  excel: {
    category: "File Format",
    icon: "table",
    description: "Read and write Microsoft Excel files.",
    color: "cyan",
  },
  aws: {
    category: "Storage",
    icon: "cloud",
    description: "Additional AWS integration utilities.",
  },
  azure: {
    category: "Storage",
    icon: "cloud",
    description: "Azure storage integration.",
  },
};

function provenance(extension: ExtensionInfo): string {
  if (
    extension.installationMode === "STATICALLY_LINKED" ||
    extension.repository === "core" ||
    extension.repository === "core_nightly"
  )
    return "Official";
  if (extension.repository === "community") return "Community";
  if (!extension.installed && descriptions[extension.name]) return "Official";
  return extension.repository ? "Custom" : "Unknown";
}

type ExtensionAction = {
  label: string;
  primary?: boolean;
  icon?: string;
  action?: { actionId: string; input?: unknown };
  link?: string;
  tab?: string;
  description?: string;
  disabledReason?: string;
  confirmation?: { title: string; description: string; confirmLabel?: string };
};

type ExtensionItem = {
  id: string;
  title: string;
  description?: string;
  detail?: string;
  icon: string;
  category?: string;
  status?: { label: string; tone?: string };
  version?: string;
  actions?: ExtensionAction[];
};

type ExtensionPanel = {
  title: string;
  description?: string;
  facts?: { label: string; value: string; icon?: string; tone?: string }[];
  links?: { label: string; url: string; icon?: string }[];
  actions?: ExtensionAction[];
  items?: ExtensionItem[];
  code?: { label: string; value: string; language: "sql" | "text" }[];
  status?: { label: string; tone?: string };
};

function reference(binding: { actionId: string; input?: unknown }) {
  return { actionId: binding.actionId, input: binding.input };
}

function extensionActions(extension: ExtensionInfo): ExtensionAction[] {
  if (!extension.installed)
    return [
      {
        label: "Install",
        primary: true,
        action: reference(installExtension({ name: extension.name })),
      },
    ];
  if (!extension.loaded)
    return [
      {
        label: "Load",
        icon: "play",
        action: reference(loadExtension({ name: extension.name })),
      },
    ];
  return (["unload", "reload"] as const).map((mode) => ({
    label: mode === "unload" ? "Unload" : "Reload",
    icon: mode,
    action: reference(
      restartExtension({ name: extension.name, mode, confirmed: true }),
    ),
    disabledReason: extension.restartRestriction,
    confirmation: {
      title: `${mode === "unload" ? "Unload" : "Reload"} ${extension.name} and restart the session?`,
      description:
        "This restarts the entire DuckDB database session. In-memory data, temporary tables, open transactions, attachments, and session settings will be lost. Data already committed to local database files is kept. Other loaded extensions will be restored. Automatic extension loading will be turned off for this session; you can still load extensions explicitly.",
      confirmLabel: `Restart and ${mode}`,
    },
  }));
}

function extensionItem(extension: ExtensionInfo): ExtensionItem {
  const info = descriptions[extension.name];
  const origin = provenance(extension);
  return {
    id: extension.name,
    title: extension.name,
    description: info?.description ?? extension.description,
    detail:
      extension.name === "httpfs"
        ? "S3, GCS, S3-compatible storage, HTTP"
        : undefined,
    icon: info?.icon ?? "layers",
    category: info?.category ?? "Other",
    status: {
      label: extension.loaded
        ? "Loaded"
        : extension.installed
          ? "Installed"
          : "Available",
      tone: extension.loaded ? "healthy" : "muted",
    },
    version: extension.version,
    actions: extensionActions(extension),
  };
}

function extensionProfile(
  extension: ExtensionInfo,
  all: ExtensionInfo[],
  settings: { name: string; value: string }[],
) {
  const item = extensionItem(extension);
  const httpfs = extension.name === "httpfs";
  const actions = item.actions ?? [];
  const origin = provenance(extension);
  const quotedName = `"${extension.name.replaceAll('"', '""')}"`;
  const identifier = /^[a-z_][a-z_0-9]*$/i.test(extension.name)
    ? extension.name
    : quotedName;
  const usage = {
    label: "Load extension",
    value: `INSTALL ${identifier};\nLOAD ${identifier};`,
    language: "sql" as const,
  };
  const example = httpfs
    ? {
        label: "Basic example",
        value:
          "SELECT * FROM read_parquet('s3://my-bucket/data/events.parquet');\nSELECT * FROM read_csv('https://example.com/data.csv');",
        language: "sql" as const,
      }
    : undefined;
  const docs = httpfs
    ? "https://duckdb.org/docs/current/core_extensions/httpfs/overview"
    : "https://duckdb.org/docs/current/core_extensions/overview";
  const repository = httpfs
    ? "https://github.com/duckdb/duckdb-httpfs"
    : "https://github.com/duckdb/duckdb";
  const configPanel: ExtensionPanel = {
    title: "Configuration",
    description: settings.length
      ? "Current connection settings. Authentication is managed through DuckDB secrets."
      : "No extension-specific settings are exposed for this connection. Consult the documentation for configuration and authentication options.",
    facts: settings.length
      ? settings.map((setting) => ({
          label: setting.name,
          value: setting.value,
          icon: "gear",
        }))
      : undefined,
    links: [{ label: "Configuration documentation", url: docs, icon: "file" }],
    actions: [{ label: "Open query editor", link: "/query", icon: "terminal" }],
  };
  const about: ExtensionPanel = {
    title: "About",
    description: httpfs
      ? "The httpfs extension connects DuckDB to remote files over HTTP(S) and the S3 API. Read files from web endpoints, or read and write objects in Amazon S3, Google Cloud Storage, and compatible services. Azure Blob Storage uses the separate azure extension."
      : extension.description ||
        "This extension adds capabilities to your DuckDB instance.",
    links: [
      { label: "DuckDB documentation", url: docs, icon: "file" },
      ...(httpfs
        ? [
            { label: "Source code", url: repository, icon: "braces" },
            {
              label: "License (MIT)",
              url: `${repository}/blob/main/LICENSE`,
              icon: "file",
            },
          ]
        : []),
    ],
    facts: [
      {
        label: "Version",
        value:
          extension.version ||
          (extension.installed ? "Not reported" : "Not installed"),
        icon: "clock",
      },
      {
        label: "Status",
        value: item.status?.label ?? "Unknown",
        icon: "clock",
        tone: item.status?.tone,
      },
      { label: "Type", value: origin, icon: "file" },
      { label: "Category", value: item.category ?? "Other", icon: "hash" },
      {
        label: "Size",
        value:
          extension.sizeBytes === undefined
            ? "Not available"
            : `${(extension.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
        icon: "file",
      },
      {
        label: "Loaded at",
        value:
          extension.loaded && extension.loadedAt
            ? `${new Date(extension.loadedAt).toISOString().replace("T", " ").slice(0, 19)} UTC`
            : "Not recorded",
        icon: "calendar",
      },
    ],
  };
  const aside: ExtensionPanel[] = [
    {
      title: "Status",
      status: item.status,
      description: extension.loaded
        ? "This extension is currently loaded and ready to use."
        : extension.installed
          ? "This extension is installed. Load it to use it in this session."
          : "Install this extension to add it to your DuckDB instance.",
      actions,
    },
  ];
  const related = httpfs
    ? all
        .filter((entry) => entry.name === "aws" || entry.name === "azure")
        .map(extensionItem)
    : [];
  if (related.length)
    aside.push({ title: "Related extensions", items: related });
  const code = example ? [usage, example] : [usage];
  return {
    title: extension.name,
    description: item.description,
    icon: httpfs ? "cloud-file" : item.icon,
    status: item.status,
    tags: [
      item.category ?? "Other",
      ...(httpfs ? ["I/O", "Cloud"] : []),
      origin,
    ],
    version: extension.version || undefined,
    actions,
    tabs: [
      {
        id: "overview",
        label: "Overview",
        panels: [
          about,
          {
            title: "Quick actions",
            actions: actions.map((action) => ({
              ...action,
              label: `${action.label} extension`,
              description:
                action.label === "Unload"
                  ? "Restart without this extension"
                  : action.label === "Reload"
                    ? "Restart and load again"
                    : "Add to this connection",
            })),
          },
          { title: "Usage", code },
        ],
        aside,
      },
      { id: "configuration", label: "Configuration", panels: [configPanel] },
      {
        id: "examples",
        label: "Examples",
        panels: [
          {
            title: "Usage examples",
            description:
              "Replace example URLs with your own data source before running these statements.",
            code,
          },
        ],
      },
      {
        id: "dependencies",
        label: "Dependencies",
        panels: [
          {
            title: "Dependencies",
            description:
              "DuckDB does not expose a dependency manifest for this installed extension. Review its source documentation for build and runtime requirements.",
            links: [{ label: "Extension source", url: repository }],
          },
        ],
      },
      {
        id: "changelog",
        label: "Changelog",
        panels: [
          {
            title: "Changelog",
            description:
              "Release history is maintained in the extension's source repository.",
            links: [
              {
                label: "View release history",
                url: `${repository}/commits/main`,
              },
            ],
          },
        ],
      },
    ],
  };
}

const extensionOrder = [
  "httpfs",
  "parquet",
  "json",
  "sqlite_scanner",
  "sqlite",
  "postgres_scanner",
  "postgres",
  "mysql_scanner",
  "mysql",
  "iceberg",
  "delta",
  "spatial",
  "fts",
  "vss",
  "excel",
];

function extensionRows(extensions: ExtensionInfo[]) {
  const rank = (name: string) => {
    const index = extensionOrder.indexOf(name);
    return index === -1 ? extensionOrder.length : index;
  };
  return [...extensions]
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .map((extension) => {
      const info = descriptions[extension.name];
      const origin = provenance(extension);
      return {
        name: extension.name,
        description: info?.description ?? extension.description,
        icon: info?.icon ?? "layers",
        provenance: origin,
        category: info?.category ?? "Other",
        status: extension.loaded
          ? "Loaded"
          : extension.installed
            ? "Installed"
            : "Available",
        statusTone: extension.loaded ? "healthy" : "muted",
        version: extension.version ?? "",
        canInstall: !extension.installed,
        canLoad: extension.installed && !extension.loaded,
        canUnload: extension.loaded,
        canReload: extension.loaded,
        canRestart: !extension.restartRestriction,
        restartRestriction: extension.restartRestriction ?? "",
        installed: extension.installed,
        loaded: extension.loaded,
      };
    });
}

export const extensions = defineResource({
  id: "extensions",
  query: (_input: undefined, ctx: DuckDbContext) => ctx.client.listExtensions(),
  refresh: poll("60s"),
});

export const extensionDetails = defineResource({
  id: "extension-details",
  input: z.object({ name: z.string() }),
  query: async ({ name }, ctx: DuckDbContext) => {
    const extension = (await ctx.client.listExtensions()).find(
      (candidate) => candidate.name === name,
    );
    if (!extension) throw new Error(`Extension not found: ${name}`);
    return extension;
  },
});

export const extensionCatalog = defineResource({
  id: "extension-catalog",
  query: async (_: undefined, ctx: DuckDbContext) =>
    extensionRows(await ctx.client.listExtensions()),
});
// Explicitly allowlist non-secret settings. Never publish proxies or credentials.
const HTTP_SETTINGS = new Set([
  "http_timeout",
  "http_retries",
  "http_retry_wait_ms",
  "http_retry_backoff",
  "http_keep_alive",
  "http_max_connections",
  "enable_http_metadata_cache",
]);
export const extensionProfileResource = defineResource({
  id: "extension-profile",
  input: z.object({ name: z.string().min(1) }),
  query: async ({ name }, ctx: DuckDbContext) => {
    const extensions = await ctx.client.listExtensions();
    const extension = extensions.find((item) => item.name === name);
    if (!extension) throw new Error(`Extension not found: ${name}`);
    const settings =
      name === "httpfs" && extension.loaded
        ? (await ctx.client.listSettings("http")).filter((setting) =>
            HTTP_SETTINGS.has(setting.name),
          )
        : [];
    return extensionProfile(extension, extensions, settings);
  },
});
