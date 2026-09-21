import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
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
  resources: [status],
  actions: [ping],
  pages: [overviewPage],
});
