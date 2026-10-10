import {
  ADAPTER_API_VERSION,
  type AdapterDefinition,
} from "@northgraindata/dsui-adapter-sdk";
import { AdapterLoadError } from "./types.js";

/** Structural gate: every loaded module must satisfy the SDK contract. */
export function assertAdapterDefinition(
  value: unknown,
  from: string,
): AdapterDefinition {
  const problem = (detail: string) =>
    new AdapterLoadError(`Invalid adapter definition from ${from}: ${detail}`);
  if (!value || typeof value !== "object") throw problem("not an object");
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "adapter") throw problem("missing kind");
  const metadata = candidate.metadata as Record<string, unknown>;
  if (!metadata || typeof metadata.id !== "string" || !metadata.id)
    throw problem("metadata.id must be a non-empty string");
  const apiVersion = candidate.apiVersion ?? candidate.sdkVersion;
  if (apiVersion !== ADAPTER_API_VERSION)
    throw problem(
      `targets adapter API ${String(apiVersion)}; host requires ${ADAPTER_API_VERSION}`,
    );
  if (typeof candidate.createContext !== "function")
    throw problem("missing createContext factory");
  for (const key of ["stores", "resources", "actions", "pages"] as const) {
    if (!Array.isArray(candidate[key])) throw problem(`missing ${key} list`);
  }
  // Jobs and signals were added after the initial adapter SDK release. Treat
  // absent lists as empty so previously built bundles remain loadable.
  return {
    ...candidate,
    jobs: Array.isArray(candidate.jobs) ? candidate.jobs : [],
    signals: Array.isArray(candidate.signals) ? candidate.signals : [],
  } as unknown as AdapterDefinition;
}
