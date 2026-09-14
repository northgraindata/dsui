import type {
  StorePersistenceProvider,
  StorePersistenceRequest,
} from "@northgraindata/dsui-adapter-sdk";
import type { DsuiDatabase } from "./database.js";

/** Durable store provider scoped to one DSUI service connection. */
export class SqliteStorePersistenceProvider
  implements StorePersistenceProvider
{
  constructor(
    private readonly database: DsuiDatabase,
    private readonly namespace: string,
  ) {}

  async load(request: StorePersistenceRequest) {
    return this.database.loadStoreState(this.namespace, request);
  }

  async save(request: StorePersistenceRequest & { readonly value: unknown }) {
    this.database.saveStoreState(this.namespace, request);
  }
}
