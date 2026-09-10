import { expect, test } from "bun:test";
import { resolveActionSuccessLink } from "./ResourceViews";

const link = {
  path: "/dags/:dagId/runs/:dagRunId",
  params: { dagId: "dagId", dagRunId: "dagRunId" },
};

test("resolves and URL-encodes a destination from successful action data", () => {
  expect(
    resolveActionSuccessLink(link, {
      dagId: "daily/events",
      dagRunId: "manual__2026-09-10T12:00:00+02:00",
    }),
  ).toBe("/dags/daily%2Fevents/runs/manual__2026-09-10T12%3A00%3A00%2B02%3A00");
});

test("does not navigate for malformed or incomplete action data", () => {
  expect(resolveActionSuccessLink(link, "unexpected")).toBeNull();
  expect(resolveActionSuccessLink(link, { dagId: "daily" })).toBeNull();
});
