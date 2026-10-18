import { expect, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import { createClickHouseAdapter } from "../src/adapter";
import { createClickHouseClient } from "../src/client";
import { connectionSchema } from "../src/config";
import { inspectionStatus } from "../src/errors";
import { alterTable, createTable, createView } from "../src/management";
import {
  columns,
  databases,
  ddl,
  inspectSystem,
  relations,
  tableDetails,
} from "../src/resources";
import { isSystemView, viewNames } from "../src/system-views";

const endpoint = process.env.CLICKHOUSE_TEST_URL;
test.skipIf(!endpoint)(
  "real ClickHouse: catalog, precision, operations, commands and bounds",
  async () => {
    const config = connectionSchema.parse({
      method: "url",
      url: endpoint,
      compression: false,
    });
    const client = createClickHouseClient(config);
    const ctx = { client, config };
    const database = `dsui_test_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      await client.execute(`CREATE DATABASE ${database}`);
      await client.execute(
        `CREATE TABLE ${database}.sample (id UInt64, amount Decimal(20,2), label Nullable(String)) ENGINE MergeTree ORDER BY id`,
      );
      await client.execute(
        `INSERT INTO ${database}.sample VALUES (9007199254740993, 123456789012345678.90, NULL)`,
      );
      const result = await client.execute(`SELECT * FROM ${database}.sample`);
      expect(result.rows[0]).toEqual({
        id: "9007199254740993",
        amount: "123456789012345678.9",
        label: null,
      });
      expect(
        (await databases.definition.query(undefined, ctx)).some(
          (row) => row.name === database,
        ),
      ).toBe(true);
      expect(
        (await relations.definition.query({ database }, ctx))[0]?.name,
      ).toBe("sample");
      expect(
        (await columns.definition.query({ database, table: "sample" }, ctx))
          .length,
      ).toBe(3);
      expect(
        (await ddl.definition.query({ database, table: "sample" }, ctx))[0].ddl,
      ).toContain("MergeTree");
      expect(
        (
          await tableDetails.definition.query(
            { database, table: "sample" },
            ctx,
          )
        )?.primary_key,
      ).toBe("id");
      expect(
        (await inspectSystem("parts", ctx, { database, table: "sample" }))
          .length,
      ).toBeGreaterThan(0);
      expect((await inspectSystem("settings", ctx)).length).toBeGreaterThan(0);
      await expect(
        client.execute("SELECT number FROM numbers(100)", { maxRows: 1 }),
      ).rejects.toThrow();
      await expect(client.execute("SELECT 1 FORMAT CSV")).rejects.toThrow(
        "FORMAT",
      );
    } finally {
      await client.execute(`DROP DATABASE IF EXISTS ${database}`);
      await client.dispose();
    }
  },
  30_000,
);

test.skipIf(!endpoint)(
  "real ClickHouse: cancellation uses a separate control connection",
  async () => {
    const config = connectionSchema.parse({
      method: "url",
      url: endpoint,
      maxConnections: 1,
      compression: false,
    });
    const client = createClickHouseClient(config);
    const inspector = createClickHouseClient(config);
    const running = client.execute("SELECT sleep(3) AS waited").then(
      () => "completed",
      () => "cancelled",
    );
    try {
      let queryId: unknown;
      for (let attempt = 0; attempt < 30 && !queryId; attempt++) {
        const rows = (
          await inspector.execute(
            "SELECT query_id FROM system.processes WHERE startsWith(query, 'SELECT sleep(3)')",
          )
        ).rows;
        queryId = rows[0]?.query_id;
        if (!queryId) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(typeof queryId).toBe("string");
      if (typeof queryId !== "string")
        throw new Error("Running query was not visible");
      const cancellation = await client.cancel(queryId);
      expect(cancellation.length).toBeGreaterThan(0);
      expect(await running).toBe("cancelled");
    } finally {
      await client.dispose();
      await inspector.dispose();
    }
  },
  15_000,
);

test.skipIf(!endpoint)(
  "real ClickHouse: restricted users can browse while optional inspections fail",
  async () => {
    const config = connectionSchema.parse({
      method: "url",
      url: endpoint,
      compression: false,
    });
    const admin = createClickHouseClient(config);
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const database = `dsui_restricted_${suffix}`;
    const username = `dsui_reader_${suffix}`;
    let reader: ReturnType<typeof createClickHouseClient> | undefined;
    try {
      await admin.execute(`CREATE DATABASE ${database}`);
      await admin.execute(
        `CREATE TABLE ${database}.sample (id UInt64) ENGINE Memory`,
      );
      await admin.execute(
        `CREATE USER ${username} IDENTIFIED WITH sha256_password BY 'fixture-password'`,
      );
      await admin.execute(`GRANT SELECT ON ${database}.* TO ${username}`);
      // Replace endpoint credentials when switching from the admin to the reader.
      if (config.method !== "url") throw new Error("Expected URL test config");
      const readerUrl = new URL(config.url);
      readerUrl.username = "";
      readerUrl.password = "";
      reader = createClickHouseClient({
        ...config,
        url: readerUrl.href,
        database,
        databaseScope: "selected",
        username,
        password: "fixture-password",
        readOnly: true,
      });
      const ctx = {
        client: reader,
        config: { ...config, database, databaseScope: "selected" as const },
      };
      expect(
        (await reader.execute(`SELECT * FROM ${database}.sample`)).rows,
      ).toEqual([]);
      expect(
        (await relations.definition.query({ database }, ctx))[0]?.name,
      ).toBe("sample");
      await expect(inspectSystem("users", ctx)).rejects.toThrow();
      await expect(
        reader.execute(`DROP TABLE ${database}.sample`),
      ).rejects.toThrow();
      expect((await reader.execute("SELECT 1 AS alive")).rows[0]?.alive).toBe(
        1,
      );
    } finally {
      if (reader) await reader.dispose();
      await admin.execute(`DROP USER IF EXISTS ${username}`);
      await admin.execute(`DROP DATABASE IF EXISTS ${database}`);
      await admin.dispose();
    }
  },
  30_000,
);

test.skipIf(!endpoint)(
  "real ClickHouse: guided table/view creation and confirmed alterations",
  async () => {
    const config = connectionSchema.parse({
      method: "url",
      url: endpoint,
      compression: false,
    });
    const instance = await createAdapterInstance(
      createClickHouseAdapter(),
      config,
    );
    const database = `dsui_manage_${crypto.randomUUID().replaceAll("-", "")}`;
    const base = {
      database,
      name: "events",
      confirmTarget: `${database}.events`,
    };
    try {
      await instance.context.client.execute(`CREATE DATABASE ${database}`);
      const created = await instance.executeAction(
        createTable({
          ...base,
          columns: "id UInt64, ts DateTime",
          engine: "MergeTree",
          orderBy: "id",
          partitionBy: "toYYYYMM(ts)",
        }),
      );
      expect(created.status).toBe("success");
      const view = await instance.executeAction(
        createView({
          database,
          name: "view_events",
          confirmTarget: `${database}.view_events`,
          kind: "view",
          select: `SELECT * FROM ${database}.events`,
        }),
      );
      expect(view.status).toBe("success");
      const added = await instance.executeAction(
        alterTable({
          ...base,
          operation: "add-column",
          definition: "label Nullable(String)",
        }),
      );
      expect(added.status).toBe("success");
      expect(
        (
          await columns.definition.query(
            { database, table: "events" },
            instance.context,
          )
        ).length,
      ).toBe(3);
      const activity = await inspectSystem("processes", instance.context);
      expect(
        activity.every((row) => row.can_cancel === 0 || row.can_cancel === 1),
      ).toBe(true);
    } finally {
      await instance.context.client.execute(
        `DROP DATABASE IF EXISTS ${database}`,
      );
      await instance.dispose();
    }
  },
  30_000,
);

test.skipIf(!endpoint)(
  "real ClickHouse: every inspection executes or reports an absent/unauthorized table",
  async () => {
    const config = connectionSchema.parse({
      method: "url",
      url: endpoint,
      compression: false,
    });
    const client = createClickHouseClient(config);
    try {
      for (const name of viewNames) {
        if (!isSystemView(name)) throw new Error("Unexpected inspection");
        try {
          expect(
            Array.isArray(await inspectSystem(name, { client, config })),
          ).toBe(true);
        } catch (error) {
          if (
            !["unavailable", "unauthorized"].includes(inspectionStatus(error))
          )
            throw new Error(
              `${name}: ${error instanceof Error ? error.message : "inspection failed"}`,
            );
        }
      }
    } finally {
      await client.dispose();
    }
  },
  30_000,
);
