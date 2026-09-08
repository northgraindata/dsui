import { describe, expect, it } from "vitest";
import { adapterFromPublicAdapter, normalizeRenderer, titleFor } from "./api";

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
