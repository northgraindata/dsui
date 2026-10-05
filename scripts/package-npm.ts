import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { prepareSdk } from "../packages/server/src/adapters/sdk";

const root = resolve(import.meta.dir, "..");
const output = join(root, "dist", "npm");
const version = process.env.DSUI_VERSION ?? "0.1.0-dev";
const bunVersion = "1.3.12";

async function run(command: string[]): Promise<void> {
  const process = Bun.spawn(command, {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0)
    throw new Error(`${command.join(" ")} exited with ${exitCode}`);
}

async function bundle(
  entrypoint: string,
  outfile: string,
  external: string[] = [],
): Promise<void> {
  await mkdir(dirname(outfile), { recursive: true });
  await run([
    "bun",
    "build",
    entrypoint,
    "--bundle",
    "--minify",
    "--target",
    "bun",
    "--format",
    "esm",
    ...external.flatMap((item) => ["--external", item]),
    "--outfile",
    outfile,
  ]);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await run(["bun", "run", "--filter", "@northgraindata/dsui-web", "build"]);
await bundle("packages/server/src/main.ts", join(output, "dist", "server.mjs"));
await bundle(
  "packages/plugin-sdk/src/index.ts",
  join(output, "dist", "plugin-sdk.mjs"),
);

await bundle(
  "examples/example-plugin/src/index.ts",
  join(output, "dist", "runtime", "plugins", "example-plugin.mjs"),
);
await cp(
  join(root, "examples", "example-plugin", "src", "browser.mjs"),
  join(output, "dist", "runtime", "plugins", "example-plugin.browser.mjs"),
);

await bundle(
  "packages/plugin-health/src/plugin.ts",
  join(output, "dist", "runtime", "plugins", "health.mjs"),
);

await run([
  "bun",
  "build",
  "packages/plugin-health/src/browser.tsx",
  "--bundle",
  "--target",
  "browser",
  "--format",
  "esm",
  "--outfile",
  join(output, "dist", "runtime", "plugins", "health.browser.mjs"),
]);

await bundle(
  "packages/plugin-monitoring/src/plugin.ts",
  join(output, "dist", "runtime", "plugins", "monitoring.mjs"),
);

await bundle(
  "packages/plugin-code-repository/src/plugin.ts",
  join(output, "dist", "runtime", "plugins", "code-repository.mjs"),
);
await run([
  "bun",
  "build",
  "packages/plugin-code-repository/src/browser.tsx",
  "--bundle",
  "--target",
  "browser",
  "--format",
  "esm",
  "--outfile",
  join(output, "dist", "runtime", "plugins", "code-repository.browser.mjs"),
]);

await cp(join(root, "apps", "web", "dist"), join(output, "web"), {
  recursive: true,
});
// Adapters are built from source at runtime, so the package ships the SDK they
// resolve against instead of bundling each adapter up front.
await prepareSdk(join(root, "packages"), join(output, "sdk"), version);
await mkdir(join(output, "bin"), { recursive: true });
await writeFile(
  join(output, "bin", "dsui.mjs"),
  `#!/usr/bin/env node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let bundledBun = "";
try {
  bundledBun = join(dirname(require.resolve("bun/package.json")), "bin", "bun.exe");
} catch {
  // Let the error below explain that the npm dependency is missing.
}
const bun = process.env.DSUI_BUN ?? bundledBun;
if (!bun || spawnSync(bun, ["--version"], { stdio: "ignore" }).error) {
  console.error("DSUI could not find its bundled runtime. Reinstall the package with npm scripts enabled.");
  process.exit(1);
}

const env = {
  ...process.env,
  DSUI_VERSION: "${version}",
  DSUI_WEB_ROOT: join(packageRoot, "web"),
  DSUI_RUNTIME_PLUGINS: join(packageRoot, "dist", "runtime", "plugins"),
  DSUI_SDK_ROOT: join(packageRoot, "sdk"),
};
if (!env.DSUI_CONFIG) {
  const localConfig = join(process.cwd(), "dsui.yaml");
  if (existsSync(localConfig)) env.DSUI_CONFIG = localConfig;
}
const child = spawn(bun, [join(packageRoot, "dist", "server.mjs"), ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
`,
  "utf8",
);
await chmod(join(output, "bin", "dsui.mjs"), 0o755);

await writeFile(
  join(output, "package.json"),
  `${JSON.stringify(
    {
      name: "@northgraindata/dsui",
      version,
      description: "A local operational workspace for your data stack.",
      type: "module",
      bin: { dsui: "bin/dsui.mjs" },
      exports: { "./plugin-sdk": "./dist/plugin-sdk.mjs" },
      files: ["bin", "dist", "sdk", "web"],
      engines: { node: ">=18" },
      dependencies: { bun: bunVersion },
      repository: {
        type: "git",
        url: "https://github.com/northgraindata/dsui.git",
      },
      license: "Apache-2.0",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

await writeFile(
  join(output, "README.md"),
  "# DSUI\n\nRun DSUI locally with your host tools, including dbt:\n\n```sh\nnpx @northgraindata/dsui\n```\n\nDocker remains available for isolated deployments.\n",
  "utf8",
);

console.log(`npm package prepared at ${output} (${version})`);
