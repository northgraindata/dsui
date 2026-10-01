import {
  defineAdapter,
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import { createContext, exampleConnectionSchema } from "./context.js";
import { overviewPage } from "./pages.js";
import { ping, status } from "./resources.js";

export default defineAdapter({
  metadata: {
    id: "example",
    name: "Example",
    version: "1.0.0",
    author: "DSUI",
    description: "A minimal example adapter with a browser component.",
  },
  connectionMethods: {
    http: {
      label: "HTTP",
      description: "A placeholder endpoint.",
      schema: exampleConnectionSchema,
    },
  },
  context: createContext,
  /**
   * Every adapter must state what healthy means for the system it integrates
   * with, so this example shows the smallest useful health function. A real
   * adapter would issue a real request here.
   */
  latencyBudgetMs: 1_000,
  health: async () =>
    healthReport({
      checks: [reachabilityCheck(true)],
      weights: { reachability: 1 },
      status: "healthy",
    }),
  resources: [status],
  actions: [ping],
  pages: [overviewPage],
});
