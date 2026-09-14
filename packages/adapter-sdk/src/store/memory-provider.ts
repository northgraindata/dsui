import type {
  StorePersistenceProvider,
  StorePersistenceRequest,
} from "./types";

/** In-memory provider useful for tests and ephemeral hosts. */
export class MemoryStorePersistenceProvider
  implements StorePersistenceProvider
{
  private readonly values = new Map<
    string,
    { readonly value: unknown; readonly version: number }
  >();

  load(request: StorePersistenceRequest) {
    return Promise.resolve(this.values.get(this.key(request)) ?? null);
  }

  save(request: StorePersistenceRequest & { readonly value: unknown }) {
    this.values.set(this.key(request), {
      value: request.value,
      version: request.version,
    });
    return Promise.resolve();
  }

  private key(request: StorePersistenceRequest): string {
    return `${request.scope}:${request.storeId}:${request.key}`;
  }
}
