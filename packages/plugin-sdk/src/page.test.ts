import { expect, test } from "bun:test";
import { matchRoute, resolvePluginPage } from "./page";

test("dynamic pages capture nested file paths, encoded characters and an empty root", () => {
  const pattern = "/services/:serviceId/files/*path";
  expect(
    matchRoute(pattern, "/services/retail/files/folder/space%20%23%20%2B.tsx"),
  ).toEqual({ serviceId: "retail", path: "folder/space # +.tsx" });
  expect(matchRoute(pattern, "/services/retail/files")).toEqual({
    serviceId: "retail",
    path: "",
  });
  expect(matchRoute(pattern, "/services/retail")).toBeNull();
});
test("existing page IDs and static paths take precedence over dynamic routes", () => {
  const wildcard = { id: "files", path: "/services/:serviceId/*path" };
  const settings = { id: "settings", path: "/services/:serviceId/settings" };
  const overview = { id: "overview", path: "/services/all" };
  const pages = [wildcard, settings, overview];
  expect(resolvePluginPage(pages, "overview")).toBe(overview);
  expect(resolvePluginPage(pages, "services/all")).toBe(overview);
  expect(resolvePluginPage(pages, "services/retail/settings")).toBe(settings);
  expect(resolvePluginPage(pages, "services/retail/src/app.ts")).toBe(wildcard);
});
