import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const shim = `${here}src/testing/bun-sqlite.ts`;
const hono = `${here}src/testing/hono-bun.ts`;

export default defineConfig({
  resolve: {
    alias: [
      { find: /^hono\/bun$/, replacement: hono },
      { find: /^bun:sqlite$/, replacement: shim },
    ],
  },
  ssr: {
    noExternal: [/bun:sqlite/, /sqlite-driver/],
  },
});
