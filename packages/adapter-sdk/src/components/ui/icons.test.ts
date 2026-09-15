import { describe, expect, test } from "bun:test";
import { iconPaths } from "./icons.js";

// Every icon name referenced by adapter pages must resolve to a real glyph
// instead of the fallback. Extend this list when adapters use new names.
const ADAPTER_ICON_NAMES = [
  "activity",
  "braces",
  "calendar",
  "check",
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
  "layers",
  "more",
  "network",
  "pause",
  "pin",
  "play",
  "reload",
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
