/**
 * Contracts shared by dsui's server and web app. This package is
 * browser-safe by construction: types and constants only, no node APIs,
 * no framework imports. Neither side imports the other; both import here.
 */

export type ServiceHealth = "healthy" | "warning" | "unavailable" | "unknown";

export interface HealthStatus {
  status: ServiceHealth;
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
}

export type AuthorizationClass = "inspect" | "execute";

/** Every API error response. */
export interface ApiError {
  message: string;
}

/** One named connection method as served by GET /api/v1/adapters. */
export interface PublicConnectionMethod {
  id: string;
  label: string;
  description?: string;
  /** JSON Schema for this method's fields (excludes `method`). */
  schema: Record<string, unknown>;
  /** Presentational group; the form renders these methods as sub-tabs. */
  group?: {
    id: string;
    label: string;
    description?: string;
  };
}

/** One adapter as served by GET /api/v1/adapters. */
export interface PublicAdapter {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  /** Load outcome; "unavailable" carries the loader error in detail. */
  status: "ok" | "unavailable";
  detail?: string;
  /** JSON Schema for the connection object, when the adapter declares one. */
  connectionSchema?: Record<string, unknown>;
  /** Named connection methods, when the adapter declares them. */
  connectionMethods?: PublicConnectionMethod[];
  resources: Array<{ id: string; inputSchema?: Record<string, unknown> }>;
  actions: Array<{ id: string; inputSchema?: Record<string, unknown> }>;
  pages: Array<{ path: string }>;
}

/** One service as served by the services API. */
export interface PublicService {
  id: string;
  name: string;
  adapter: string;
  health: ServiceHealth;
  detail?: string;
  latencyMs?: number;
  managedBy: "configuration" | "ui";
  resources: string[];
  actions: string[];
  logo?: string;
}

export type {
  CatalogFilter,
  EntityAction,
  EntityBadge,
  EntityDetail,
  EntityFact,
  EntityItem,
  EntityLink,
  EntityPanel,
  EntityTone,
} from "./entity-document";
export { parseEntityCatalog, parseEntityDetail } from "./entity-document";
export type {
  ActionIcon,
  ActionListItem,
  ActionReference,
  MeterData,
  MeterSegment,
  OverviewCard,
  PageDocument,
  PageHeaderAction,
  PageHeaderBadge,
  PageNode,
  QueryExplorerDocument,
  ResourceReference,
  ResourceTreeBranchDocument,
  SectionLink,
  StatGridItem,
  TableRowAction,
  TableRowLink,
} from "./page-document.js";
