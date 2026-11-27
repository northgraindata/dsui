import { expect, test } from "bun:test";
import { findRoute, queryLinks, routeKey } from "./routes";

test("literal routes win over parameter routes", () => {
  const pages = [{ path: "/dags/:dagId" }, { path: "/dags/new" }];
  expect(findRoute(pages, "/dags/new")?.path).toBe("/dags/new");
  expect(findRoute(pages, "/dags/a")?.path).toBe("/dags/:dagId");
  expect(findRoute(pages, "/missing")).toBeUndefined();
});

test("a route key ignores gallery parameters, order and encoding", () => {
  expect(routeKey("/dags/a%20b?runId=1&tab=graph&scenario=large&shell=1")).toBe(
    routeKey("/dags/a b?tab=graph&runId=1"),
  );
  expect(routeKey("/dags?toolbar=0")).toBe("/dags");
});

test("only concrete links with a query need their own fixture", () => {
  const links = new Set<string>();
  queryLinks(
    [
      { link: "/dags/a?tab=graph" },
      { link: "/dags/a" },
      { link: { path: "/dags/:dagId?tab=graph" } },
      { label: "Why?" },
    ],
    links,
  );
  expect([...links]).toEqual(["/dags/a?tab=graph"]);
});
