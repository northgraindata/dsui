import { appendFileSync } from "node:fs";

export type Layer = "adapter-sdk" | "plugin-sdk" | "product";
export function scopeForPaths(paths: string[], layer: Layer) {
  const shared = paths.some((path) =>
    /^(package\.json|bun\.lock|tsconfig\.json|turbo\.json|biome\.json|\.github\/|patches\/|scripts\/)/.test(
      path,
    ),
  );
  const codePaths = paths.filter(
    (path) => !/\.(md|mdx|png|jpe?g|webp)$/.test(path),
  );
  const adapter = codePaths.some((path) =>
    /^(packages\/adapter-|examples\/example-adapter\/|packages\/ui\/)/.test(
      path,
    ),
  );
  const plugin = codePaths.some((path) =>
    /^(packages\/plugin-|examples\/example-plugin\/)/.test(path),
  );
  const product = codePaths.some((path) =>
    /^(apps\/web\/|packages\/(server|core|renderer)\/|Dockerfile|docker-compose)/.test(
      path,
    ),
  );
  const docs = paths.some((path) => /^(apps\/(docs|site)\/)/.test(path));
  const affected = {
    "adapter-sdk": adapter,
    "plugin-sdk": adapter || plugin,
    product: adapter || plugin || product,
  };
  const run = shared || affected[layer];
  // SDK changes need host consumers, but do not build a container on every PR.
  return {
    run,
    docs: layer === "product" && (docs || shared),
    docker: layer === "product" && (shared || product),
  };
}

if (import.meta.main) {
  const layer = process.argv[2];
  if (layer !== "adapter-sdk" && layer !== "plugin-sdk" && layer !== "product")
    throw new Error("Unknown CI layer");
  const base = process.env.CI_BASE;
  const head = process.env.CI_HEAD || "HEAD";
  let paths: string[];
  if (process.env.CI_FORCE === "true" || !base || /^0+$/.test(base)) {
    paths = ["package.json"];
  } else {
    const child = Bun.spawnSync(["git", "diff", "--name-only", base, head]);
    if (child.exitCode !== 0) throw new Error(child.stderr.toString());
    paths = child.stdout.toString().trim().split("\n").filter(Boolean);
  }
  const scope = scopeForPaths(paths, layer);
  console.log(JSON.stringify(scope));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(scope)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
}
