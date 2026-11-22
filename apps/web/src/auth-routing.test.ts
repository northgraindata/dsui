import { expect, test } from "bun:test";
import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { isPublicPluginPage } from "./auth-routing";

const pages: PluginCatalog["pages"] = [
  { pluginId: "auth-pro", id: "login", title: "Sign in", public: true },
  { pluginId: "auth-pro", id: "users", title: "Users" },
];

test("anonymous visitors can reach the authentication plugin's login page", () => {
  expect(isPublicPluginPage("/plugins/auth-pro/login", pages)).toBe(true);
});

test("app screens and private plugin pages require sign-in", () => {
  for (const path of [
    "/",
    "/services/warehouse",
    "/plugins/auth-pro/users",
    "/plugins/other/login",
    "/plugins/auth-pro/absent",
  ]) {
    expect(isPublicPluginPage(path, pages)).toBe(false);
  }
});
