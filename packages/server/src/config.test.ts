import { describe, expect, test } from "bun:test";
import {
  type AdapterSource,
  configSchema,
  type DsuiConfig,
  isAdapterSource,
  toAdapterPackageSource,
} from "./config";

const commit = "a".repeat(40);
const integrity = `sha384-${"A".repeat(64)}`;

function source(config: DsuiConfig, id: string): AdapterSource {
  const entry = config.adapters?.[id];
  if (!entry) throw new Error(`missing adapter entry: ${id}`);
  if (!isAdapterSource(entry)) throw new Error(`not an adapter source: ${id}`);
  return entry;
}

describe("config adapter sources", () => {
  test("parses and maps a pinned git source", () => {
    const config = configSchema.parse({
      adapters: {
        acme: {
          source: "git",
          repository: "git+https://github.com/acme/dsui-adapter-thing",
          commit,
          integrity,
        },
      },
    });
    expect(toAdapterPackageSource(source(config, "acme"))).toEqual({
      source: "git",
      repository: "git+https://github.com/acme/dsui-adapter-thing",
      commit,
      integrity,
    });
  });

  test("maps local and npm sources unchanged", () => {
    const config = configSchema.parse({
      adapters: {
        local: { package: "@acme/dsui-adapter-thing" },
        pinned: {
          package: "@acme/dsui-adapter-thing",
          version: "1.2.3",
          integrity: `sha512-${"B".repeat(86)}`,
        },
      },
    });
    expect(toAdapterPackageSource(source(config, "local"))).toEqual({
      package: "@acme/dsui-adapter-thing",
    });
    expect(toAdapterPackageSource(source(config, "pinned"))).toEqual({
      package: "@acme/dsui-adapter-thing",
      version: "1.2.3",
      integrity: `sha512-${"B".repeat(86)}`,
    });
  });

  test("treats presentation overrides as non-sources", () => {
    const config = configSchema.parse({
      adapters: {
        airflow: { name: "Airflow", description: "Operate DAGs" },
      },
    });
    const entry = config.adapters?.airflow;
    if (!entry) throw new Error("missing override entry");
    expect(isAdapterSource(entry)).toBe(false);
  });

  test("rejects floating git refs and short commits", () => {
    const base = {
      source: "git",
      repository: "git+https://github.com/acme/dsui-adapter-thing",
      commit,
      integrity,
    };
    expect(() =>
      configSchema.parse({ adapters: { a: { ...base, commit: "main" } } }),
    ).toThrow();
    expect(() =>
      configSchema.parse({
        adapters: { a: { ...base, repository: "https://github.com/a/b" } },
      }),
    ).toThrow();
  });
});
