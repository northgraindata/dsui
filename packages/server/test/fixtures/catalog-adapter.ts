import { defineAdapter, z } from "@northgraindata/dsui-adapter-sdk";

export default defineAdapter({
  metadata: {
    id: "catalog-fixture",
    name: "Community database",
    version: "1.2.3",
    author: "Community maintainer",
    presentation: {
      category: "Databases",
      overview: "A community adapter with its own catalog page.",
      features: [
        { title: "Schema explorer", description: "Browse relations." },
      ],
      limitations: ["Requires an account with read access."],
      links: [
        {
          kind: "documentation",
          label: "Documentation",
          href: "https://example.com/docs",
        },
      ],
    },
  },
  health: async () => ({ status: "healthy", score: 100, checks: [] }),
  connectionMethods: {
    api: { label: "API endpoint", schema: z.object({ url: z.string().url() }) },
  },
});
