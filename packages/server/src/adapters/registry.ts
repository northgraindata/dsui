import type { AdapterInfo } from "@northgraindata/dsui-adapter-sdk";
import type { LoadedAdapter } from "./types.js";

/** Presentation overrides applied on top of adapter-declared metadata. */
export interface AdapterMetadataPatch {
  name?: string;
  description?: string;
  iconUrl?: string;
}

/**
 * Logical id → loaded adapter. The registry never imports adapter
 * packages and never branches on adapter identity; loading is the
 * loader's job.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, LoadedAdapter>();

  constructor(adapters: readonly LoadedAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: LoadedAdapter): void {
    if (adapter.id !== adapter.metadata.id)
      throw new Error(
        `Adapter registry key "${adapter.id}" differs from metadata id "${adapter.metadata.id}"`,
      );
    if (this.adapters.has(adapter.id))
      throw new Error(`Adapter is already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  /** Restores the given definitions, dropping previously applied overrides. */
  reset(adapters: readonly LoadedAdapter[]): void {
    this.adapters.clear();
    for (const adapter of adapters) this.register(adapter);
  }

  /** Applies a config-driven presentation patch; unknown ids are ignored. */
  applyMetadata(id: string, patch: AdapterMetadataPatch): void {
    const base = this.adapters.get(id);
    if (!base) return;
    const metadata: AdapterInfo = { ...base.metadata };
    if (patch.name !== undefined) metadata.name = patch.name;
    if (patch.description !== undefined)
      metadata.description = patch.description;
    if (patch.iconUrl !== undefined) metadata.iconUrl = patch.iconUrl;
    this.adapters.set(id, { ...base, metadata });
  }

  get(id: string): LoadedAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown adapter: ${id}`);
    return adapter;
  }

  list(): LoadedAdapter[] {
    return [...this.adapters.values()];
  }
}
