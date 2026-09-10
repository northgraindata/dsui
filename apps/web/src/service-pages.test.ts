import { describe, expect, it } from "vitest";
import { connectionTestMessage, navigablePagePaths } from "./service-pages";

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
