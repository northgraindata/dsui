import { join } from "node:path";
import { createRuntime } from "./app";

const runtime = createRuntime({
  webRoot: process.env.DSUI_WEB_ROOT ?? join(process.cwd(), "apps/web/dist"),
});
await runtime.refreshConfig();
const port = Number(process.env.DSUI_PORT ?? 8787);
const hostname = process.env.DSUI_HOST ?? "0.0.0.0";
const server = Bun.serve({ fetch: runtime.app.fetch, port, hostname });
console.log(`dsui server listening on http://${hostname}:${server.port}`);
