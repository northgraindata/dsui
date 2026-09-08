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
  ActionReference,
  PageDocument,
  PageNode,
  ResourceReference,
} from "./page-document.js";
