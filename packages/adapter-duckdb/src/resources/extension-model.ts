import type { ExtensionInfo } from "../context.js";

export const descriptions: Record<
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

export function provenance(extension: ExtensionInfo): string {
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

export function extensionRows(extensions: ExtensionInfo[]) {
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
