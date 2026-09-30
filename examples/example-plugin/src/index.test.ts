import { describe, expect, test } from "bun:test";
import type { RuntimePluginProcedure } from "@northgraindata/dsui-plugin-sdk";
import plugin from "./index";

describe("example plugin", () => {
  test("registers typed host procedures for greeting and service listing", async () => {
    const procedures: RuntimePluginProcedure[] = [];
    const prepared = plugin.prepare(
      { greeting: "Welcome" },
      {
        services: {
          list: async () => ({
            items: [
              {
                id: "warehouse",
                name: "Warehouse",
                adapter: "duckdb",
                managedBy: "configuration",
              },
            ],
          }),
          get: async () => null,
        },
        logger: { info() {}, warn() {}, error() {} },
      },
    );
    prepared.setup({
      page() {},
      navigation() {},
      slot() {},
      procedure(procedure) {
        procedures.push(procedure);
      },
    });

    const greeting = procedures.find((procedure) => procedure.id === "greet");
    const listing = procedures.find(
      (procedure) => procedure.id === "list-services",
    );
    expect(await greeting?.invoke({ name: "DSUI" })).toBe("Welcome, DSUI");
    expect(await listing?.invoke({})).toEqual({
      items: [
        {
          id: "warehouse",
          name: "Warehouse",
          adapter: "duckdb",
          managedBy: "configuration",
        },
      ],
    });
  });
});
