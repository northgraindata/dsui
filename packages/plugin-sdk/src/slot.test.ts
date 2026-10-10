import { describe, expect, test } from "bun:test";
import { defineSlot } from "./slot";

describe("plugin overlay slots", () => {
  test("requires presentation metadata for overlay slots", () => {
    expect(() =>
      defineSlot({ id: "help", slot: "overlay", render: () => [] }),
    ).toThrow("Overlay slots require a presentation");
  });

  test("accepts modal and stable anchored targets", () => {
    expect(
      defineSlot({
        id: "help",
        slot: "overlay",
        presentation: { mode: "modal", label: "Help" },
        render: () => [],
      }).presentation,
    ).toEqual({ mode: "modal", label: "Help" });
    expect(
      defineSlot({
        id: "tip",
        slot: "overlay",
        presentation: {
          mode: "anchored",
          target: "service.workspace.header",
          placement: "bottom",
        },
        render: () => [],
      }).presentation?.mode,
    ).toBe("anchored");
  });

  test("rejects external and malformed navigation paths", () => {
    for (const path of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/bad\npath",
    ]) {
      expect(() =>
        defineSlot({
          id: "tip",
          slot: "overlay",
          presentation: { mode: "anchored", target: "app.content", path },
          render: () => [],
        }),
      ).toThrow("local app paths");
    }
  });

  test("rejects presentation metadata on a regular slot and empty anchors", () => {
    expect(() =>
      defineSlot({
        id: "widget",
        slot: "sidebar.profile",
        presentation: { mode: "modal" },
        render: () => [],
      }),
    ).toThrow("Only overlay slots may specify a presentation");
    expect(() =>
      defineSlot({
        id: "tip",
        slot: "overlay",
        presentation: { mode: "anchored", target: "  " },
        render: () => [],
      }),
    ).toThrow("Anchored overlays require a target id");
  });
});

test("preserves contextual interaction bindings and rejects ambiguous sources", () => {
  const presentation = {
    mode: "anchored" as const,
    target: "query.editor",
    dock: "bottom-right" as const,
    path: "/services/example/query?sql=SELECT%201",
    advanceOn: {
      serviceId: "example",
      target: "query.results",
      event: "success",
      overlay: "result",
    },
  };
  expect(
    defineSlot({ id: "query", slot: "overlay", presentation, render: () => [] })
      .presentation,
  ).toEqual(presentation);
  expect(() =>
    defineSlot({
      id: "query",
      slot: "overlay",
      presentation: {
        ...presentation,
        advanceOn: { ...presentation.advanceOn, pluginId: "other" },
      },
      render: () => [],
    }),
  ).toThrow("Invalid overlay interaction binding");
});
