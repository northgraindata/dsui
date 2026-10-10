import { readdirSync, readFileSync } from "node:fs";
import type { Layer } from "./ci-scope";

export function layerPaths(layer: Layer): string[] {
  const packages = readdirSync("packages").filter((name) => {
    try {
      return Boolean(
        JSON.parse(readFileSync(`packages/${name}/package.json`, "utf8")).name,
      );
    } catch {
      return false;
    }
  });
  if (layer === "adapter-sdk")
    return packages
      .filter((name) => name.startsWith("adapter-") || name === "ui")
      .map((name) => `packages/${name}`)
      .concat("examples/example-adapter");
  if (layer === "plugin-sdk")
    return packages
      .filter((name) => name.startsWith("plugin-"))
      .map((name) => `packages/${name}`)
      .concat("examples/example-plugin");
  return [
    "packages/server",
    "packages/core",
    "packages/renderer",
    "apps/web",
    "scripts",
  ];
}

async function run(args: string[]): Promise<void> {
  const child = Bun.spawn(args, { stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) throw new Error(`Failed: ${args.join(" ")}`);
}

if (import.meta.main) {
  const layer = process.argv[2];
  const task = process.argv[3];
  if (layer !== "adapter-sdk" && layer !== "plugin-sdk" && layer !== "product")
    throw new Error("Unknown CI layer");
  const paths = layerPaths(layer);
  if (task === "lint")
    await run(["bun", "x", "--no-install", "biome", "check", ...paths]);
  else if (task === "test")
    await run([
      "bun",
      "test",
      "--pass-with-no-tests",
      ...paths.map((path) => `./${path}`),
    ]);
  else if (task === "typecheck" || task === "build") {
    const names = paths
      .filter((path) => path !== "scripts")
      .map(
        (path) => JSON.parse(readFileSync(`${path}/package.json`, "utf8")).name,
      );
    await run([
      "bun",
      "x",
      "--no-install",
      "turbo",
      "run",
      task,
      ...names.map((name) => `--filter=${name}`),
    ]);
    if (task === "build" && layer !== "product") {
      const { packageSdk } = await import("./release-packages");
      if (layer === "adapter-sdk") await packageSdk("ui");
      await packageSdk(layer);
    }
  } else throw new Error("Unknown CI task");
}
