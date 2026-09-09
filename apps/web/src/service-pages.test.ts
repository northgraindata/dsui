import { describe, expect, it } from "vitest";
import {
  connectionTestMessage,
  navigablePagePaths,
  servicePagePath,
} from "./service-pages";

describe("servicePagePath", () => {
  it("uses the adapter default for an empty catch-all route", () => {
    expect(servicePagePath(undefined)).toBeUndefined();
    expect(servicePagePath("")).toBeUndefined();
  });

  it("converts a populated catch-all route to an adapter page path", () => {
    expect(servicePagePath("dags/example")).toBe("/dags/example");
  });
});

describe("navigablePagePaths", () => {
  it("keeps only concrete top-level adapter pages in the sidebar", () => {
    expect(
      navigablePagePaths([
        "/",
        "/tables",
        "/databases",
        "/databases/:database",
        "/databases/:database/schemas/:schema",
        "/databases/:database/schemas/:schema/tables/:table",
        "/query",
      ]),
    ).toEqual(["/", "/tables", "/databases", "/query"]);
  });
});

describe("connectionTestMessage", () => {
  it("recognizes the server's healthy status field", () => {
    expect(
      connectionTestMessage({
        status: "healthy",
        checkedAt: "2026-09-09T10:00:00.000Z",
        latencyMs: 12,
      }),
    ).toBe("Connection healthy · 12ms");
  });

  it("shows the server detail for an unavailable connection", () => {
    expect(
      connectionTestMessage({
        status: "unavailable",
        checkedAt: "2026-09-09T10:00:00.000Z",
        detail: "Database file does not exist",
      }),
    ).toBe("Database file does not exist");
  });
});
