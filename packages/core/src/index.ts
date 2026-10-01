/**
 * HTTP contracts shared by the DSUI server and web app.
 *
 * This package intentionally contains only browser-safe types. Adapter
 * protocol and component contracts belong to the adapter SDK.
 */

export type ServiceHealth = "healthy" | "warning" | "unavailable" | "unknown";

/**
 * One measured health signal.
 *
 * `id` is an open string: the host carries signals without interpreting
 * them, so an adapter can report a signal no core release has heard of.
 */
export interface ServiceHealthCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface HealthStatus {
  status: ServiceHealth;
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
  /**
   * Overall health from 0 to 100.
   *
   * Computed by the adapter from its own signals rather than by the host,
   * because only the adapter knows what a healthy value is for the system it
   * integrates with. Optional so a consumer can treat its absence as
   * "not scored" instead of assuming zero.
   */
  score?: number;
  /** Individual signals behind the score. */
  checks?: ServiceHealthCheck[];
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
  components: Array<{ id: string; path: string }>;
  browserComponentsUrl?: string;
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
