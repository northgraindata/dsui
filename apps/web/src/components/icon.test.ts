import { describe, expect, test } from "bun:test";
import { iconPaths } from "./icon.js";

// Mirror of the SDK registry coverage: every icon name referenced by
// adapter pages or workspace chrome must resolve to a real glyph.
const ADAPTER_ICON_NAMES = [
  "activity",
  "braces",
  "calendar",
  "check",
  "chevron",
  "clock",
  "close",
  "cloud",
  "cpu",
  "database",
  "eye",
  "file",
  "folder",
  "gear",
  "grid",
  "hash",
  "history",
  "home",
  "layers",
  "more",
  "network",
  "pause",
  "pin",
  "play",
  "plug",
  "plus",
  "refresh",
  "reload",
  "search",
  "table",
  "terminal",
  "warning",
];

describe("icon registry", () => {
  for (const name of ADAPTER_ICON_NAMES) {
    test(`resolves ${name}`, () => {
      expect(iconPaths[name]).toBeDefined();
    });
  }
});
