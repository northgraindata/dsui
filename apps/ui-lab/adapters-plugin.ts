import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { Plugin } from "vite";
const run = promisify(execFile);
export function adaptersPlugin(): Plugin {
  return {
    name: "dsui-adapter-lab",
    resolveId(id) {
      if (id === "virtual:dsui-adapters") return "\0dsui-adapters";
    },
    async load(id) {
      if (id !== "\0dsui-adapters") return;
      const root = resolve(import.meta.dirname, "../..");
      this.addWatchFile(resolve(import.meta.dirname, "adapter-snapshots.ts"));
      for (const directory of await readdir(resolve(root, "packages"))) {
        if (!directory.startsWith("adapter-") || directory === "adapter-sdk")
          continue;
        const source = resolve(root, "packages", directory, "src");
        for (const file of await readdir(source, { recursive: true }))
          if (/\.tsx?$/.test(file)) this.addWatchFile(resolve(source, file));
      }
      const { stdout } = await run(
        "bun",
        [resolve(import.meta.dirname, "adapter-snapshots.ts")],
        { cwd: root, maxBuffer: 16 * 1024 * 1024 },
      );
      return `export const adapterPages = ${stdout};`;
    },
    handleHotUpdate(ctx) {
      if (
        !/packages\/adapter-[^/]+\/src\//.test(ctx.file) &&
        !ctx.file.endsWith("/adapter-snapshots.ts")
      )
        return;
      // Adapter pages can introduce a browser component after the Lab starts.
      // Refresh the eager glob as well as the serialized page document.
      const registry = resolve(
        import.meta.dirname,
        "../../packages/renderer/src/registry/component-registry.ts",
      );
      for (const module of ctx.server.moduleGraph.getModulesByFile(registry) ??
        []) {
        ctx.server.moduleGraph.invalidateModule(module);
      }
      const module = ctx.server.moduleGraph.getModuleById("\0dsui-adapters");
      if (module) {
        ctx.server.moduleGraph.invalidateModule(module);
        ctx.server.ws.send({ type: "full-reload" });
      }
    },
  };
}
