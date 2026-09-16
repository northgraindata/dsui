import { describe, expect, test } from "bun:test";
import {
  createDbtBackend,
  DBT_ACTION_IDS,
  DBT_COMMAND_IDS,
  DBT_RESOURCE_IDS,
  DbtNotImplementedError,
  dbtAdapter,
  getDbtReadiness,
  publicDbtConfig,
  validateDbtConfig,
} from "../src/index.js";

const cloud = {
  method: "cloud" as const,
  baseUrl: "https://emea.dbt.com",
  accountId: "123",
  apiToken: { secretRef: "secret/dbt-cloud-token" },
};

describe("dbt adapter contract", () => {
  test("declares Cloud and Local connection methods", () => {
    expect(dbtAdapter.connectionMethods?.map(({ id }) => id)).toEqual([
      "cloud",
      "local",
    ]);
    expect(dbtAdapter.connectionSchema?.safeParse(cloud).success).toBe(true);
    expect(
      dbtAdapter.connectionSchema?.safeParse({
        method: "local",
        projectPath: "/workspace/project",
      }).success,
    ).toBe(true);
  });

  test("rejects invalid methods and malformed Cloud configuration", () => {
    expect(() => validateDbtConfig({ method: "other" })).toThrow(
      'dbt connection method must be "cloud" or "local"',
    );
    expect(() =>
      validateDbtConfig({ method: "cloud", baseUrl: "not-url" }),
    ).toThrow();
    expect(() =>
      validateDbtConfig({
        method: "cloud",
        baseUrl: "https://user:password@emea.dbt.com",
        accountId: "123",
        apiToken: { secretRef: "secret/dbt-cloud-token" },
      }),
    ).toThrow("must not contain credentials");
  });

  test("keeps secret references out of public connection metadata", () => {
    expect(publicDbtConfig(validateDbtConfig(cloud))).toEqual({
      method: "cloud",
      endpoint: "https://emea.dbt.com",
    });
    expect(
      JSON.stringify(publicDbtConfig(validateDbtConfig(cloud))),
    ).not.toContain("secret/dbt-cloud-token");
  });

  test("reports valid configuration readiness without claiming execution support", () => {
    const result = getDbtReadiness(validateDbtConfig(cloud));
    expect(result).toMatchObject({
      status: "ready",
      method: "cloud",
      execution: "not-implemented",
    });
  });

  test("exposes stable typed command, action, and resource ids", () => {
    expect(DBT_COMMAND_IDS).toEqual([
      "run",
      "build",
      "test",
      "compile",
      "docs-generate",
    ]);
    expect(DBT_ACTION_IDS).toContain("cancel");
    expect(DBT_RESOURCE_IDS).toEqual([
      "metadata",
      "readiness",
      "projects",
      "runs",
      "artifacts",
      "documentation",
    ]);
  });

  test("returns a clear error for provider actions", async () => {
    await expect(
      createDbtBackend().executeAction("run", {}),
    ).rejects.toBeInstanceOf(DbtNotImplementedError);
    await expect(createDbtBackend().executeAction("run", {})).rejects.toThrow(
      'dbt action "run" execution is not implemented',
    );
  });
});
