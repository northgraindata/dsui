import { describe, expect, test } from "bun:test";
import { normalizeFolderPath } from "../src/actions/apps.js";
import { createShaperAdapter } from "../src/adapter.js";
import type { ShaperClient } from "../src/context.js";

describe("adapter definition", () => {
  test("validates and exposes the expected pages", () => {
    const adapter = createShaperAdapter(() => ({}) as ShaperClient);
    expect(adapter.metadata.id).toBe("shaper");
    expect(adapter.metadata.iconUrl?.startsWith("data:image/svg+xml,")).toBe(
      true,
    );
  });
});

describe("normalizeFolderPath", () => {
  test("normalises slashes", () => {
    expect(normalizeFolderPath("")).toBe("/");
    expect(normalizeFolderPath("sales//emea")).toBe("/sales/emea/");
    expect(normalizeFolderPath("/a/")).toBe("/a/");
  });
  test("rejects traversal segments", () => {
    expect(() => normalizeFolderPath("a/../b")).toThrow();
  });
});
