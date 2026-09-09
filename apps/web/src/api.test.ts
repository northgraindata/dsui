import { describe, expect, it } from "vitest";
import {
  adapterFromPublicAdapter,
  type ConnectionMethod,
  connectionTopEntries,
  firstLeaf,
  normalizeRenderer,
  titleFor,
} from "./api";

describe("adapter UI normalization", () => {
  it("derives safe connection fields from an adapter schema", () => {
    expect(
      adapterFromPublicAdapter({
        id: "snowflake",
        name: "Snowflake",
        description: "Warehouse",
        iconUrl: "data:image/svg+xml,test",
        status: "ok",
        resources: [],
        actions: [],
        pages: [],
        connectionSchema: {
          type: "object",
          required: ["accountIdentifier", "token"],
          properties: {
            accountIdentifier: { type: "string" },
            token: { type: "string" },
            role: { type: ["string", "null"] },
          },
        },
      }),
    ).toMatchObject({
      logo: "data:image/svg+xml,test",
      fields: [
        {
          key: "accountIdentifier",
          label: "Account Identifier",
          required: true,
          type: "text",
        },
        { key: "token", required: true, type: "password" },
        { key: "role", required: false, type: "text" },
      ],
    });
  });

  it("uses an empty field list when the adapter does not declare a schema", () => {
    expect(
      adapterFromPublicAdapter({
        id: "fixture",
        name: "Fixture",
        description: "Fixture adapter",
        status: "ok",
        resources: [],
        actions: [],
        pages: [],
      }).fields,
    ).toEqual([]);
  });

  it("derives tabbed connection methods from the adapter schema", () => {
    const adapter = adapterFromPublicAdapter({
      id: "duckdb",
      name: "DuckDB",
      description: "Embedded OLAP",
      status: "ok",
      resources: [],
      actions: [],
      pages: [],
      connectionMethods: [
        {
          id: "memory",
          label: "In-memory",
          schema: { type: "object", properties: {} },
        },
        {
          id: "file",
          label: "Local file",
          description: "A .duckdb file on disk.",
          schema: {
            type: "object",
            required: ["path"],
            properties: { path: { type: "string" } },
          },
        },
      ],
    });
    expect(adapter.connectionMethods).toHaveLength(2);
    expect(adapter.connectionMethods?.[0]).toMatchObject({
      id: "memory",
      label: "In-memory",
      fields: [],
    });
    expect(adapter.connectionMethods?.[1]).toMatchObject({
      id: "file",
      label: "Local file",
      description: "A .duckdb file on disk.",
      fields: [{ key: "path", label: "Path", type: "text", required: true }],
    });
  });

  it("groups connection methods into top-level tabs in order", () => {
    const leaf = (
      id: string,
      group?: ConnectionMethod["group"],
    ): ConnectionMethod => ({
      id,
      label: id,
      fields: [],
      ...(group ? { group } : {}),
    });
    const tops = connectionTopEntries([
      leaf("memory"),
      leaf("s3", { id: "remote", label: "Remote" }),
      leaf("gcs", { id: "remote", label: "Remote" }),
      leaf("file"),
    ]);
    expect(tops.map((t) => (t.kind === "group" ? t.id : t.method.id))).toEqual([
      "memory",
      "remote",
      "file",
    ]);
    const remote = tops[1];
    expect(remote?.kind).toBe("group");
    if (remote?.kind === "group") {
      expect(remote.methods.map((m) => m.id)).toEqual(["s3", "gcs"]);
      expect(firstLeaf(remote)?.id).toBe("s3");
    }
    expect(firstLeaf(tops[0])?.id).toBe("memory");
    expect(firstLeaf(undefined)).toBeUndefined();
    expect(connectionTopEntries()).toEqual([]);
  });

  it("maps the stable query kind to the core-owned workbench", () => {
    expect(normalizeRenderer("query")).toBe("query-workbench");
  });

  it("preserves supported declarative renderer kinds", () => {
    expect(normalizeRenderer("topic-browser")).toBe("topic-browser");
    expect(normalizeRenderer("object-browser")).toBe("object-browser");
  });

  it("fails safely to a generic record renderer for an unknown kind", () => {
    expect(normalizeRenderer("untrusted-react-component")).toBe("record-list");
  });

  it("uses practical titles for common capability IDs", () => {
    expect(titleFor("consumer-groups")).toBe("Consumer groups");
  });
});
