import { expect, test } from "bun:test";
import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { groupPluginNavigation } from "./plugin-navigation";

const navigation = (pluginId: string, id = "overview") => ({
  pluginId,
  id,
  pageId: id,
  label: id,
  area: "primary" as const,
});
const plugin = (
  id: string,
  options: Partial<PluginCatalog["plugins"][number]> = {},
): PluginCatalog["plugins"][number] => ({
  id,
  name: id,
  version: "1.0.0",
  status: "ready",
  ...options,
});

test("groups visible plugins by category while preserving catalog order and every page", () => {
  const groups = groupPluginNavigation({
    plugins: [
      plugin("timeline", {
        category: "Monitoring",
        iconUrl: "data:image/webp;base64,a",
      }),
      plugin("code", { category: "Code" }),
      plugin("health", { category: " Monitoring " }),
      plugin("legacy"),
      plugin("blank", { category: "  " }),
    ],
    navigation: [
      navigation("legacy"),
      navigation("timeline"),
      navigation("health"),
      navigation("code"),
      navigation("timeline", "history"),
      navigation("blank"),
    ],
  });
  expect(groups.map((group) => group.label)).toEqual([
    "Code",
    "Monitoring",
    "Extensions",
  ]);
  expect(
    groups[1]?.items.map((item) => `${item.pluginId}/${item.pageId}`),
  ).toEqual(["timeline/overview", "health/overview", "timeline/history"]);
  expect(groups[1]?.items[0]?.iconUrl).toBe("data:image/webp;base64,a");
  expect(groups[2]?.items.map((item) => item.pluginId)).toEqual([
    "legacy",
    "blank",
  ]);
});

test("does not invent entries or show orphaned, disabled or unavailable contributions", () => {
  expect(
    groupPluginNavigation({
      plugins: [
        plugin("disabled", { status: "disabled" }),
        plugin("failed", { status: "unavailable" }),
        plugin("no-page"),
      ],
      navigation: [
        navigation("disabled"),
        navigation("failed"),
        navigation("hidden"),
      ],
    }),
  ).toEqual([]);
});
