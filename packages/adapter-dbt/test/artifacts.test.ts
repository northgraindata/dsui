import { describe, expect, test } from "bun:test";
import {
  DbtArtifactError,
  detectDbtArtifact,
  readCatalog,
  readManifest,
  readRunResults,
  readSources,
} from "../src/index.js";

const metadata = {
  dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
  dbt_version: "1.8.0",
  generated_at: "2026-09-16T00:00:00Z",
};

describe("dbt artifact readers", () => {
  test("normalizes a v1 manifest and does not retain unknown fields", () => {
    const result = readManifest(
      JSON.stringify({
        metadata,
        nodes: {
          "model.analytics.orders": {
            resource_type: "model",
            name: "orders",
            package_name: "analytics",
            original_file_path: "models/orders.sql",
            depends_on: { nodes: ["source.analytics.raw_orders"] },
            secret_payload: "must not escape",
          },
        },
        extra_payload: { untrusted: true },
      }),
    );

    expect(result.summary).toEqual({
      nodeCount: 1,
      nodes: [
        {
          uniqueId: "model.analytics.orders",
          resourceType: "model",
          name: "orders",
          packageName: "analytics",
          path: "models/orders.sql",
          dependsOn: ["source.analytics.raw_orders"],
        },
      ],
      resourceCounts: { model: 1 },
    });
    expect(result.metadata).toEqual({
      dbtVersion: "1.8.0",
      generatedAt: "2026-09-16T00:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("secret_payload");
  });

  test("reads catalog, run results, and source freshness summaries", () => {
    expect(
      readCatalog(
        JSON.stringify({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/catalog/v5.json",
          },
          nodes: {
            "model.a.orders": {
              name: "orders",
              type: "TABLE",
              columns: { id: {} },
            },
          },
          sources: {},
        }),
      ).summary,
    ).toMatchObject({
      nodeCount: 1,
      sourceCount: 0,
      nodes: [{ columnCount: 1 }],
    });
    expect(
      readRunResults(
        JSON.stringify({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/run-results/v6.json",
          },
          results: [
            {
              unique_id: "model.a.orders",
              status: "success",
              execution_time: 1.25,
            },
          ],
        }),
      ).summary,
    ).toMatchObject({ resultCount: 1, statusCounts: { success: 1 } });
    expect(
      readSources(
        JSON.stringify({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/sources/v3.json",
          },
          results: [
            {
              unique_id: "source.a.raw",
              status: "pass",
              max_loaded_at: "2026-09-15T00:00:00Z",
            },
          ],
        }),
      ).summary,
    ).toMatchObject({ resultCount: 1, results: [{ status: "pass" }] });
  });

  test("detects a representative Fusion v2 artifact without widening fields", () => {
    const artifact = {
      metadata: {
        dbt_schema_version: metadata.dbt_schema_version,
        dbt_version: "2.0.0-fusion",
      },
      nodes: {},
    };
    expect(detectDbtArtifact(artifact)).toMatchObject({
      kind: "manifest",
      version: 12,
      compatibility: "fusion-v2",
    });
    expect(
      readManifest(new TextEncoder().encode(JSON.stringify(artifact))).summary
        .nodeCount,
    ).toBe(0);
  });

  test("rejects malformed JSON, missing versions, unsupported versions, and oversized input", () => {
    expect(() => readManifest("{")).toThrowError(DbtArtifactError);
    expect(() =>
      readManifest(JSON.stringify({ metadata: {}, nodes: {} })),
    ).toThrow("missing metadata.dbt_schema_version");
    expect(() =>
      readManifest(
        JSON.stringify({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/manifest/v99.json",
          },
          nodes: {},
        }),
      ),
    ).toThrow("unsupported manifest schema version");
    expect(() =>
      readManifest(JSON.stringify({ metadata, nodes: {} }), { maxBytes: 10 }),
    ).toThrow("exceeds 10 byte limit");
  });

  test("reports warnings for missing optional fields", () => {
    const result = readManifest(
      JSON.stringify({
        metadata: { dbt_schema_version: metadata.dbt_schema_version },
        nodes: {},
      }),
    );
    expect(result.warnings).toEqual([
      "optional field missing: dbtVersion",
      "optional field missing: generatedAt",
    ]);
  });
});
