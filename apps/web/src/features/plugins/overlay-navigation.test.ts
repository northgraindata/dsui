import { expect, test } from "bun:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import {
  overlayHref,
  overlayMatchesRoute,
  sameOverlayLocation,
} from "./overlay-navigation";

test("mounted router paths match tour destinations without the browser prefix", async () => {
  const root = createRootRoute();
  const home = createRoute({ getParentRoute: () => root, path: "/" });
  const models = createRoute({
    getParentRoute: () => root,
    path: "/services/transformations/models",
  });
  for (const destination of ["/", "/services/transformations/models"]) {
    const router = createRouter({
      routeTree: root.addChildren([home, models]),
      basepath: "/demo",
      history: createMemoryHistory({
        initialEntries: [overlayHref(destination, "/demo/")],
      }),
    });
    await router.load();
    expect(
      overlayMatchesRoute(router.state.location.pathname, destination),
    ).toBe(true);
    expect(overlayMatchesRoute(router.state.location.pathname, "/other")).toBe(
      false,
    );
  }
});

test("tour navigation keeps every destination inside the application mount", () => {
  for (const path of [
    "/",
    "/services/transformations/models",
    "/plugins/health/overview",
    "/services/snapshot/query?sql=SELECT%201",
  ]) {
    expect(overlayHref(path, "/demo/")).toBe(`/demo${path}`);
    expect(overlayHref(path, "/")).toBe(path);
  }
  expect(
    sameOverlayLocation(
      "/demo/services/snapshot/query?sql=SELECT+1",
      overlayHref("/services/snapshot/query?sql=SELECT%201", "/demo/"),
    ),
  ).toBe(true);
});

test("advancing a tour preserves query results despite equivalent URL encoding", () => {
  const path = "/services/snapshot/query";
  expect(
    sameOverlayLocation(
      `${path}?sql=SELECT+%27paid%27%3B`,
      `${path}?sql=SELECT%20'paid'%3B`,
    ),
  ).toBe(true);
  expect(sameOverlayLocation(`${path}?a=1&b=2`, `${path}?b=2&a=1`)).toBe(true);
  expect(sameOverlayLocation(`${path}?sql=one`, `${path}?sql=two`)).toBe(false);
  expect(sameOverlayLocation(path, "/services/analytics/query")).toBe(false);
  expect(sameOverlayLocation(path, `${path}?sql=`)).toBe(false);
});
