import { type Config, validateConfig } from "./config";
import { TrinoClient } from "./trino-client";
export type TrinoContext = { config: Config; client: TrinoClient };
export function createContext(config: Config): TrinoContext {
  const valid = validateConfig(config);
  return { config: valid, client: new TrinoClient(valid) };
}
