import { explainSnowflakeError } from "./errors.js";

type Binds = readonly (string | number | boolean | null)[];
type Run = (
  sql: string,
  maxRows: number,
  binds?: Binds,
) => Promise<Record<string, unknown>[]>;

export interface UsageSummary {
  credits7d: number;
  credits30d: number;
}

export interface WarehouseCredits {
  warehouse: string;
  credits: number;
  computeCredits: number;
  cloudServicesCredits: number;
}

export interface DatabaseStorage {
  database: string;
  storageGb: number;
  failsafeGb: number;
}

export interface SlowQuery {
  queryId: string;
  text: string;
  user: string | null;
  warehouse: string | null;
  elapsedSeconds: number;
  gbScanned: number;
}

/** Cost and storage views over SNOWFLAKE.ACCOUNT_USAGE (data lags by up to ~3 hours). */
export interface UsageQueries {
  usageSummary(): Promise<UsageSummary>;
  creditsByDay(): Promise<{ time: number; value: number }[]>;
  creditsByWarehouse(): Promise<WarehouseCredits[]>;
  storageByDatabase(): Promise<DatabaseStorage[]>;
  slowQueries(): Promise<SlowQuery[]>;
}

const GB = 1024 ** 3;
const round = (value: number) => Math.round(value * 100) / 100;
const num = (value: unknown) => Number(value ?? 0);

export function createUsageQueries(run: Run): UsageQueries {
  // Roles without IMPORTED PRIVILEGES fail here, so say how to fix it.
  const usage = async (sql: string, maxRows: number) => {
    try {
      return await run(sql, maxRows);
    } catch (error) {
      throw new Error(
        `${explainSnowflakeError(error)} Usage data needs: GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE <role>.`,
      );
    }
  };
  const metering = "SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY";
  return {
    async usageSummary() {
      const [row] = await usage(
        `SELECT SUM(IFF(START_TIME >= DATEADD('day', -7, CURRENT_TIMESTAMP()), CREDITS_USED, 0)) AS "credits7d", SUM(CREDITS_USED) AS "credits30d" FROM ${metering} WHERE START_TIME >= DATEADD('day', -30, CURRENT_TIMESTAMP())`,
        1,
      );
      return {
        credits7d: round(num(row?.credits7d)),
        credits30d: round(num(row?.credits30d)),
      };
    },
    async creditsByDay() {
      return (
        await usage(
          `SELECT DATE_TRUNC('day', START_TIME) AS "day", SUM(CREDITS_USED) AS "credits" FROM ${metering} WHERE START_TIME >= DATEADD('day', -30, CURRENT_TIMESTAMP()) GROUP BY 1 ORDER BY 1`,
          100,
        )
      ).map((row) => ({
        time: new Date(String(row.day)).getTime(),
        value: round(num(row.credits)),
      }));
    },
    async creditsByWarehouse() {
      return (
        await usage(
          `SELECT WAREHOUSE_NAME AS "warehouse", SUM(CREDITS_USED) AS "credits", SUM(CREDITS_USED_COMPUTE) AS "compute", SUM(CREDITS_USED_CLOUD_SERVICES) AS "cloud" FROM ${metering} WHERE START_TIME >= DATEADD('day', -30, CURRENT_TIMESTAMP()) GROUP BY 1 ORDER BY 2 DESC`,
          1_000,
        )
      ).map((row) => ({
        warehouse: String(row.warehouse),
        credits: round(num(row.credits)),
        computeCredits: round(num(row.compute)),
        cloudServicesCredits: round(num(row.cloud)),
      }));
    },
    async storageByDatabase() {
      const table = "SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY";
      return (
        await usage(
          `SELECT DATABASE_NAME AS "database", AVERAGE_DATABASE_BYTES AS "storage", AVERAGE_FAILSAFE_BYTES AS "failsafe" FROM ${table} WHERE USAGE_DATE = (SELECT MAX(USAGE_DATE) FROM ${table}) ORDER BY 2 DESC`,
          1_000,
        )
      ).map((row) => ({
        database: String(row.database),
        storageGb: round(num(row.storage) / GB),
        failsafeGb: round(num(row.failsafe) / GB),
      }));
    },
    async slowQueries() {
      return (
        await usage(
          `SELECT QUERY_ID AS "queryId", LEFT(QUERY_TEXT, 300) AS "text", USER_NAME AS "user", WAREHOUSE_NAME AS "warehouse", TOTAL_ELAPSED_TIME AS "elapsedMs", BYTES_SCANNED AS "bytes" FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY WHERE START_TIME >= DATEADD('day', -7, CURRENT_TIMESTAMP()) ORDER BY TOTAL_ELAPSED_TIME DESC LIMIT 25`,
          25,
        )
      ).map((row) => ({
        queryId: String(row.queryId),
        text: String(row.text ?? ""),
        user: row.user == null ? null : String(row.user),
        warehouse: row.warehouse == null ? null : String(row.warehouse),
        elapsedSeconds: round(num(row.elapsedMs) / 1_000),
        gbScanned: round(num(row.bytes) / GB),
      }));
    },
  };
}
