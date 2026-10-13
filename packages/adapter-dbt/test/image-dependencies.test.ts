import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

type AdapterManifest = {
  dsui: {
    image: {
      apt: string[];
      pipx: string[];
    };
  };
};

describe("dbt adapter image dependencies", () => {
  it("pins dbt-core in the adapter that requires the CLI", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as AdapterManifest;

    expect(manifest.dsui.image.pipx).toEqual(["dbt-core==1.10.15"]);
    expect(manifest.dsui.image.apt).toEqual([
      "python3",
      "python3-venv",
      "pipx",
    ]);
  });
});
