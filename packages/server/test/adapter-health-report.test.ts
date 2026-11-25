import { expect, test } from "bun:test";
import { assertHealthReport } from "../src/adapters/loader";
import { healthDetail } from "../src/routes/services";

test("service cards explain failed health checks", () => {
  expect(
    healthDetail({
      status: "warning",
      checkedAt: new Date().toISOString(),
      checks: [
        { id: "disk", label: "Disk space", ok: false, detail: "8% free" },
        { id: "scheduler", label: "Scheduler", ok: false },
        { id: "connection", label: "Connection", ok: true },
      ],
    }),
  ).toBe("Disk space: 8% free; Scheduler failed");
  expect(
    healthDetail({
      status: "unavailable",
      checkedAt: "",
      detail: "Connection failed",
    }),
  ).toBe("Connection failed");
});

const report = (href: unknown) =>
  assertHealthReport(
    {
      status: "warning",
      score: 80,
      checks: [{ id: "scheduler", label: "Scheduler", ok: false, href }],
    },
    5,
  );

test("a check may point to a path inside the service workspace", () => {
  expect(report("/dags").checks?.[0]).toMatchObject({ href: "/dags" });
  expect(report("/dags/etl?tab=runs").checks?.[0]?.href).toBe(
    "/dags/etl?tab=runs",
  );
});

test("a check link that could leave the workspace is dropped", () => {
  for (const href of [
    "https://evil.example",
    "//evil.example/x",
    "javascript:alert(1)",
    "dags",
    "/a\\b",
    "/a\nb",
    `/${"x".repeat(200)}`,
    42,
    null,
  ])
    expect(report(href).checks?.[0]).not.toHaveProperty("href");
});

test("a check without a link is otherwise unchanged", () => {
  expect(
    assertHealthReport(
      {
        status: "healthy",
        checks: [{ id: "a", label: "A", ok: true, detail: "fine" }],
      },
      5,
    ).checks,
  ).toEqual([{ id: "a", label: "A", ok: true, detail: "fine" }]);
});
