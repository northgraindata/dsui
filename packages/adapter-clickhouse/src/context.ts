import type { ClickHouseClient } from "./client.js";
import type { ClickHouseConfig } from "./config.js";
export interface ClickHouseContext {
  client: ClickHouseClient;
  config: ClickHouseConfig;
}
