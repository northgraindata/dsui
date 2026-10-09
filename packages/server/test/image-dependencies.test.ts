import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectImageDependencies,
  resolveImageDependencies,
} from "../src/image-dependencies";

const temporaryDirectories: string[] = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "dsui-image-deps-"));
  temporaryDirectories.push(root);
  return root;
}

async function addPackage(root: string, path: string, manifest: unknown) {
  const directory = join(root, path);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify(manifest));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("image dependencies", () => {
  it("collects and deduplicates adapter and plugin declarations", async () => {
    const root = await makeWorkspace();
    await addPackage(root, "packages/adapter-dbt", {
      dsui: {
        image: {
          apt: ["python3", "python3-venv"],
          pipx: [`dbt-core==\${DSUI_DBT_VERSION}`],
        },
      },
    });
    await addPackage(root, "packages/plugin-example", {
      dsui: { image: { apt: ["python3", "git"] } },
    });
    await addPackage(root, "packages/other", {
      dsui: { browser: "./browser.ts" },
    });

    expect(await collectImageDependencies(root)).toEqual({
      apt: ["git", "python3", "python3-venv"],
      pipx: [`dbt-core==\${DSUI_DBT_VERSION}`],
    });
  });

  it("resolves build arguments and validates package specifications", () => {
    expect(
      resolveImageDependencies(
        {
          apt: ["python3"],
          pipx: [`dbt-core==\${DSUI_DBT_VERSION}`],
        },
        { DSUI_DBT_VERSION: "1.10.15" },
      ),
    ).toEqual({ apt: ["python3"], pipx: ["dbt-core==1.10.15"] });

    expect(() =>
      resolveImageDependencies(
        { pipx: [`dbt-core==\${DSUI_DBT_VERSION}`] },
        {},
      ),
    ).toThrow("Missing DSUI_DBT_VERSION");
    expect(() =>
      resolveImageDependencies({ apt: ["git && curl evil"] }, {}),
    ).toThrow("Invalid apt package specification");
  });
});
