import { expect, test } from "bun:test";
import { z } from "zod";
import { definePage } from "../page/index";
import { defineResource } from "../resource/index";
import { defineAdapter } from "./define";

test("validates adapter identity", () => {
  expect(() =>
    defineAdapter({
      metadata: { id: "Bad Id", name: "X", version: "1.0.0" },
    }),
  ).toThrow();
  expect(() =>
    defineAdapter({
      metadata: { id: "ok", name: "X", version: "not-semver" },
    }),
  ).toThrow();
  expect(() =>
    defineAdapter({ metadata: { id: "ok", name: "", version: "1.0.0" } }),
  ).toThrow();
});

test("accepts a minimal one-file adapter", () => {
  const adapter = defineAdapter({
    metadata: { id: "hello", name: "Hello", version: "1.0.0" },
    pages: [definePage({ path: "/", render: () => [] })],
  });
  expect(adapter.kind).toBe("adapter");
  expect(adapter.sdkVersion).toBe("0.2.0");
  expect(adapter.pages).toHaveLength(1);
});

test("rejects duplicate resource ids and page paths", () => {
  const first = defineResource({ id: "dup", query: () => 1 });
  const second = defineResource({ id: "dup", query: () => 2 });
  expect(() =>
    defineAdapter({
      metadata: { id: "a", name: "A", version: "1.0.0" },
      resources: [first, second],
    }),
  ).toThrow();
  expect(() =>
    defineAdapter({
      metadata: { id: "a", name: "A", version: "1.0.0" },
      pages: [
        definePage({ path: "/x", render: () => [] }),
        definePage({ path: "/x", render: () => [] }),
      ],
    }),
  ).toThrow();
});

test("normalizes connection methods and synthesizes a discriminator union", () => {
  const adapter = defineAdapter({
    metadata: { id: "duckdb", name: "DuckDB", version: "1.0.0" },
    connectionMethods: {
      memory: { label: "In-memory", schema: z.object({}) },
      file: {
        label: "Local file",
        description: "A .duckdb file on disk.",
        schema: z.object({ path: z.string().min(1) }),
      },
    },
  });
  expect(adapter.connectionMethods?.map((m) => m.id)).toEqual([
    "memory",
    "file",
  ]);
  expect(adapter.connectionMethods?.[1]?.label).toBe("Local file");
  expect(adapter.connectionMethods?.[1]?.description).toBe(
    "A .duckdb file on disk.",
  );

  const parsed = adapter.connectionSchema?.parse({
    method: "file",
    path: "/tmp/x",
  });
  expect(parsed).toEqual({ method: "file", path: "/tmp/x" });
  expect(() => adapter.connectionSchema?.parse({ method: "file" })).toThrow();
  expect(() =>
    adapter.connectionSchema?.parse({ method: "unknown", path: "/tmp/x" }),
  ).toThrow();
});

test("flattens connection method groups to leaves with group tags", () => {
  const adapter = defineAdapter({
    metadata: { id: "duckdb", name: "DuckDB", version: "1.0.0" },
    connectionMethods: {
      memory: { label: "In-memory", schema: z.object({}) },
      remote: {
        label: "Remote",
        description: "Object storage.",
        methods: {
          s3: { label: "S3", schema: z.object({ url: z.string() }) },
          gcs: { label: "GCS", schema: z.object({ url: z.string() }) },
        },
      },
    },
  });
  expect(adapter.connectionMethods?.map((m) => m.id)).toEqual([
    "memory",
    "s3",
    "gcs",
  ]);
  expect(adapter.connectionMethods?.[1]?.group).toEqual({
    id: "remote",
    label: "Remote",
    description: "Object storage.",
  });
  expect(adapter.connectionMethods?.[0]?.group).toBeUndefined();

  expect(
    adapter.connectionSchema?.parse({ method: "s3", url: "s3://b" }),
  ).toEqual({ method: "s3", url: "s3://b" });
  expect(() =>
    adapter.connectionSchema?.parse({ method: "remote", url: "s3://b" }),
  ).toThrow();
});

test("rejects malformed connection method groups", () => {
  const meta = { id: "x", name: "X", version: "1.0.0" } as const;
  expect(() =>
    defineAdapter({
      metadata: meta,
      connectionMethods: {
        remote: {
          label: "Remote",
          schema: z.object({}),
          methods: { s3: { label: "S3", schema: z.object({}) } },
        },
      },
    }),
  ).toThrow("both schema and methods");
  expect(() =>
    defineAdapter({
      metadata: meta,
      connectionMethods: {
        remote: { label: "Remote", methods: {} },
      },
    }),
  ).toThrow("at least one sub-method");
  expect(() =>
    defineAdapter({
      metadata: meta,
      connectionMethods: {
        remote: {
          label: "Remote",
          methods: { "bad id": { label: "Bad", schema: z.object({}) } },
        },
      },
    }),
  ).toThrow("must be kebab-case");
  expect(() =>
    defineAdapter({
      metadata: meta,
      connectionMethods: {
        s3: { label: "S3", schema: z.object({}) },
        cloud: {
          label: "Cloud",
          methods: { s3: { label: "S3", schema: z.object({}) } },
        },
      },
    }),
  ).toThrow("Duplicate adapter connection method: s3");
  expect(() =>
    defineAdapter({
      metadata: meta,
      connectionMethods: {
        remote: {
          label: "Remote",
          methods: { remote: { label: "Remote", schema: z.object({}) } },
        },
      },
    }),
  ).toThrow("both a method and a group");
  expect(() =>
    defineAdapter({
      metadata: meta,
      // Untyped input: proves the runtime guard for callers bypassing types.
      connectionMethods: { remote: { label: "Remote" } } as never,
    }),
  ).toThrow("needs a schema or methods");
});

test("rejects ambiguous or malformed connection method definitions", () => {
  expect(() =>
    defineAdapter({
      metadata: { id: "x", name: "X", version: "1.0.0" },
      connectionMethods: {
        "bad id": { label: "Bad", schema: z.object({}) },
      },
    }),
  ).toThrow("must be kebab-case");
  expect(() =>
    defineAdapter({
      metadata: { id: "x", name: "X", version: "1.0.0" },
      connectionMethods: {
        file: { label: "", schema: z.object({}) },
      },
    }),
  ).toThrow("requires a label");
  expect(() =>
    defineAdapter({
      metadata: { id: "x", name: "X", version: "1.0.0" },
      connectionMethods: {
        file: { label: "File", schema: z.string() },
      },
    }),
  ).toThrow("must be a Zod object");
});

test("omits connection methods and union when none are declared", () => {
  const adapter = defineAdapter({
    metadata: { id: "solo", name: "Solo", version: "1.0.0" },
  });
  expect(adapter.connectionMethods).toBeUndefined();
  expect(adapter.connectionSchema).toBeUndefined();
});
