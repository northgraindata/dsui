import { expect, test } from "bun:test";
import { isValidElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { z } from "zod";
import { scenarios } from "./fixtures";

const catalogSchema = z.array(
  z.object({
    id: z.string(),
    examples: z.array(
      z.object({
        id: z.string(),
        scenario: z.enum(scenarios).optional(),
        render: z
          .function()
          .args(z.enum(scenarios))
          .returns(z.custom<ReactElement>(isValidElement)),
      }),
    ),
  }),
);

test("all catalog scenarios serialize and render through production components", async () => {
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    // A running Lab must retain its optimized dependency URLs during tests.
    cacheDir: new URL("../node_modules/.vite-lab-tests", import.meta.url)
      .pathname,
    server: { middlewareMode: true, watch: null },
  });
  try {
    const module = await server.ssrLoadModule("/src/catalog.ts");
    const catalog = catalogSchema.parse(module.catalog);
    const ids = catalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of catalog) {
      const states = entry.examples.map((example) => example.id);
      expect(new Set(states).size, entry.id).toBe(states.length);
      for (const example of entry.examples) {
        const html = renderToString(
          example.render(example.scenario ?? "normal"),
        );
        expect(html, `${entry.id}/${example.id}`).not.toContain(
          "Unknown component",
        );
        expect(html, `${entry.id}/${example.id}`).not.toContain(
          "Preview failed",
        );
      }
    }
  } finally {
    await server.close();
  }
}, 30000);
