import type { PluginPrincipal, PluginServiceCatalog } from "./index";

/** A finite target set. Input constraints are JSON Schema, never executable code. */
export type ExecutionTarget = {
  serviceId: string;
  kind: "resource" | "action";
  id: string;
  inputSchema?: Record<string, unknown>;
};
export type ExecutionAudience = {
  roles?: readonly PluginPrincipal["role"][];
  principalIds?: readonly string[];
  claims?: Readonly<Record<string, readonly string[]>>;
};
export type ExecutionGrant = {
  id: string;
  subject: string;
  revision: string;
  operationIds: readonly string[];
  targets: readonly ExecutionTarget[];
  executorId: string;
  audience: ExecutionAudience;
  expiresAt: number;
};
export type ExecutionRequest = {
  subject: string;
  revision: string;
  operationId: string;
  targets: readonly ExecutionTarget[];
  grantId?: string;
  continuationId?: string;
};
export interface PluginExecutionScope {
  readonly actor: PluginPrincipal;
  readonly executor: PluginPrincipal;
  readonly services: PluginServiceCatalog;
  /** Refresh identity and authority; reject revoked or expired execution. */
  check(): Promise<void>;
  /** Opaque, host-owned authority. Never send it to a browser or runner. */
  checkpoint(): Promise<string>;
  close(): void;
}
export interface PluginExecution {
  identity(): {
    authenticated: boolean;
    revalidation: boolean;
    delegation: boolean;
  };
  open(request: ExecutionRequest): Promise<PluginExecutionScope>;
  validateGrant(request: ExecutionRequest): Promise<void>;
  approve(grant: ExecutionGrant): Promise<void>;
  revoke(grantId: string): Promise<void>;
}
