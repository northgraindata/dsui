import type { Context, Next } from "hono";

/** Node-test stand-in for hono/bun serveStatic; production uses the real one. */
export const serveStatic =
  (_options?: unknown) => async (_context: Context, next: Next) =>
    next();
