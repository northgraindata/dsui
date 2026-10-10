import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [tarball, name, version] = process.argv.slice(2);
if (!tarball || !name || !version)
  throw new Error("Usage: publish-npm.ts <tarball> <name> <version>");
const tarballPath = resolve(tarball);
const registry = "https://registry.npmjs.org";
const lookup = Bun.spawnSync([
  "npm",
  "view",
  `${name}@${version}`,
  "dist.integrity",
  "--json",
  `--registry=${registry}`,
]);
if (lookup.exitCode === 0) {
  const expected = JSON.parse(lookup.stdout.toString());
  const actual = `sha512-${createHash("sha512")
    .update(await readFile(tarballPath))
    .digest("base64")}`;
  if (expected !== actual)
    throw new Error(
      `${name}@${version} already exists with a different artifact`,
    );
  console.log(`${name}@${version} already published with matching integrity`);
} else {
  const message = `${lookup.stdout.toString()}${lookup.stderr.toString()}`;
  if (!message.includes('"code": "E404"') && !message.includes('"code":"E404"'))
    throw new Error(message);
  const env = { ...process.env };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_CONFIG_USERCONFIG;
  const child = Bun.spawn(
    [
      "npm",
      "publish",
      tarballPath,
      `--registry=${registry}`,
      "--access",
      "public",
      "--provenance",
      "--tag",
      version.includes("-") ? "next" : "latest",
    ],
    { env, stdout: "inherit", stderr: "inherit" },
  );
  if ((await child.exited) !== 0)
    throw new Error(`Failed to publish ${name}@${version}`);
}
