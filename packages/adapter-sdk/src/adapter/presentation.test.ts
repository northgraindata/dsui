import { expect, test } from "bun:test";
import { defineAdapter } from "./define";

const base = {
  metadata: { id: "community", name: "Community adapter", version: "1.0.0" },
  health: async () => ({ status: "healthy" as const, score: 100, checks: [] }),
};

test("community adapters can declare catalog content without changing runtime capabilities", () => {
  const adapter = defineAdapter({
    ...base,
    metadata: {
      ...base.metadata,
      presentation: {
        category: " Databases ",
        features: [{ title: "SQL workspace", description: "Run queries." }],
        links: [
          {
            kind: "documentation",
            label: "Documentation",
            href: "https://example.com/docs",
          },
          { label: "More info", href: "https://example.com" },
        ],
      },
    },
  });
  expect(adapter.metadata.presentation?.category).toBe("Databases");
  expect(adapter.metadata.presentation?.features?.[0]?.title).toBe(
    "SQL workspace",
  );
  expect(adapter.metadata.presentation?.links?.[0]?.href).toBe(
    "https://example.com/docs",
  );
  expect(adapter.metadata.presentation?.links?.[0]?.kind).toBe("documentation");
  expect(adapter.metadata.presentation?.links?.[1]?.kind).toBeUndefined();
  expect(adapter.resources).toEqual([]);
  expect(defineAdapter(base).metadata).not.toHaveProperty("presentation");
});

for (const href of [
  "javascript:alert(1)",
  "data:text/html,test",
  "/relative/docs",
]) {
  test(`rejects an unsupported catalog link: ${href}`, () => {
    expect(() =>
      defineAdapter({
        ...base,
        metadata: {
          ...base.metadata,
          presentation: {
            links: [{ label: "Docs", href }],
          },
        },
      }),
    ).toThrow("Invalid adapter presentation");
  });
}

test("rejects empty feature labels rather than publishing unusable catalog content", () => {
  expect(() =>
    defineAdapter({
      ...base,
      metadata: {
        ...base.metadata,
        presentation: {
          features: [{ title: " " }],
        },
      },
    }),
  ).toThrow("Invalid adapter presentation");
});
