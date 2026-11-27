import { expect, test } from "bun:test";
import type { ManifestAdapter } from "./data";
import { resolveUrl, shellUrl } from "./urls";

const adapter = {
  id: "demo",
  pages: [
    { path: "/", slug: "index", href: "/" },
    { path: "/dags/:dagId", slug: "detail", href: "/dags/a" },
    { path: "/dags/new", slug: "new", href: "/dags/new" },
  ],
  variants: { "/dags/a?tab=graph": "variant-0" },
} as unknown as ManifestAdapter;

test("a query picks its own fixture, and unknown ones fall back", () => {
  expect(resolveUrl(adapter, "/dags/a?tab=graph")?.file).toBe("variant-0");
  expect(resolveUrl(adapter, "/dags/a?tab=other")?.file).toBe("detail");
  expect(resolveUrl(adapter, "/missing")).toBeUndefined();
});

test("application URLs keep the scenario", () => {
  const [home] = adapter.pages;
  if (!home) throw new Error("No page");
  expect(shellUrl("demo", home, "large")).toBe("/services/demo?scenario=large");
});
