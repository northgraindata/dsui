import { expect, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createComponents } from "../src/browser";

test("diagnostics start collapsed without loading the history", () => {
  let calls = 0;
  const client = {
    executeResource: () => {
      calls++;
      throw new Error("unexpected fetch");
    },
    executeAction: () => Promise.resolve({ status: "success" as const }),
    navigate: () => undefined,
  };
  const Component = createComponents(React)["monitoring/incident-history"];
  const html = renderToStaticMarkup(
    React.createElement(Component, {
      client,
      node: { kind: "custom", props: {} },
      renderNode: () => null,
    }),
  );
  expect(html).toContain("Incident history");
  expect(html).toContain("<details>");
  expect(html).not.toContain("<details open");
  expect(html).not.toContain("CPU / RAM attribution");
  expect(calls).toBe(0);
});
