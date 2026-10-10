import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { packageSdk, sdkPackages } from "./release-packages";

/** Exercise packed packages outside the workspace, with registry-style resolution. */
const root = resolve(import.meta.dir, "..");
const smoke = join(root, "dist", "sdk-smoke");
await rm(smoke, { recursive: true, force: true });
await mkdir(smoke, { recursive: true });
const dependencies: Record<string, string> = {};
const selected =
  process.argv[2] === "adapter-sdk" ? (["adapter-sdk"] as const) : sdkPackages;
for (const directory of selected) {
  const target = await packageSdk(directory);
  const manifest = JSON.parse(
    await readFile(join(target, "package.json"), "utf8"),
  );
  if (directory === "adapter-sdk") {
    if (manifest.dependencies?.["@northgraindata/dsui-ui"])
      throw new Error("Adapter SDK package must embed its private UI code");
    const embeddedUi = await readFile(
      join(target, "src", "ui", "index.tsx"),
      "utf8",
    );
    const adapterUi = await readFile(
      join(target, "src", "components", "ui", "form.tsx"),
      "utf8",
    );
    if (!embeddedUi.includes("./components/button"))
      throw new Error("Adapter SDK package is missing embedded UI sources");
    if (adapterUi.includes("@northgraindata/dsui-ui"))
      throw new Error(
        "Adapter SDK package contains an unresolved private UI import",
      );
  }
  const pack = Bun.spawnSync(
    [
      "npm",
      "pack",
      target,
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      smoke,
    ],
    { cwd: root },
  );
  if (pack.exitCode !== 0) throw new Error(pack.stderr.toString());
  const [{ filename }] = JSON.parse(pack.stdout.toString());
  dependencies[manifest.name] = `file:./${filename}`;
}
await writeFile(
  join(smoke, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies,
    overrides: Object.fromEntries(
      Object.keys(dependencies).map((name) => [name, `$${name}`]),
    ),
  }),
);
const install = Bun.spawn(
  ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
  { cwd: smoke, stdout: "inherit", stderr: "inherit" },
);
if ((await install.exited) !== 0)
  throw new Error("SDK smoke installation failed");
await writeFile(
  join(smoke, "smoke.ts"),
  `
import { defineAdapter, ADAPTER_API_VERSION } from "@northgraindata/dsui-adapter-sdk";
${selected.includes("plugin-sdk") ? 'import { definePlugin, PLUGIN_API_VERSION } from "@northgraindata/dsui-plugin-sdk"; if (typeof definePlugin !== "function" || !PLUGIN_API_VERSION) throw new Error("Missing Plugin SDK exports");' : ""}
if (typeof defineAdapter !== "function" || !ADAPTER_API_VERSION) throw new Error("Missing SDK exports");
console.log("Packed SDK imports OK");
`,
);
const run = Bun.spawn(["bun", "smoke.ts"], {
  cwd: smoke,
  stdout: "inherit",
  stderr: "inherit",
});
if ((await run.exited) !== 0) throw new Error("Packed SDK imports failed");
const browser = await Bun.build({
  entrypoints: [
    join(
      smoke,
      "node_modules/@northgraindata/dsui-adapter-sdk/src/components/ui/table.tsx",
    ),
  ],
  target: "browser",
  outdir: join(smoke, "browser"),
});
if (!browser.success)
  throw new AggregateError(browser.logs, "Packed browser subpath build failed");
