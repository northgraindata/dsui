import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installGitPlugin } from "./installer";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const digest = (value: string, algorithm: "sha256" | "sha512") =>
  createHash(algorithm)
    .update(value)
    .digest(algorithm === "sha256" ? "hex" : "base64");

function fixture() {
  const server = "export default { kind: 'dsui-plugin' };";
  const browser = "export const components = {};";
  const manifest = JSON.stringify({
    id: "example-plugin",
    version: "1.0.0",
    apiVersion: 1,
    server: {
      entry: "./dist/plugin.mjs",
      sha256: digest(server, "sha256"),
      bytes: server.length,
    },
    browser: {
      entry: "./dist/browser.mjs",
      sha256: digest(browser, "sha256"),
      bytes: browser.length,
    },
  });
  const source = {
    source: "git" as const,
    repository: "git+https://github.com/acme/plugin",
    commit: "a".repeat(40),
    integrity: `sha512-${digest(manifest, "sha512")}`,
    config: {},
    enabled: true,
  };
  const files = new Map([
    ["plugin.json", manifest],
    ["dist/plugin.mjs", server],
    ["dist/browser.mjs", browser],
  ]);
  const requested: string[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requested.push(url);
    expect(init?.redirect).toBe("error");
    const path = new URL(url).pathname.split(`/${source.commit}/`)[1];
    return new Response(files.get(path ?? "") ?? "", {
      status: files.has(path ?? "") ? 200 : 404,
    });
  };
  const dataDir = mkdtempSync(join(tmpdir(), "dsui-plugin-install-"));
  directories.push(dataDir);
  return {
    server,
    browser,
    manifest,
    source,
    files,
    requested,
    fetcher,
    dataDir,
  };
}

describe("verified GitHub plugin artifacts", () => {
  test("downloads immutable server/browser artifacts and verifies cached files offline", async () => {
    const f = fixture();
    const first = await installGitPlugin("example-plugin", f.source, {
      dataDir: f.dataDir,
      fetch: f.fetcher,
    });
    expect(first.manifest.id).toBe("example-plugin");
    expect(first.browserPath).toBeDefined();
    expect(f.requested).toEqual([
      `https://raw.githubusercontent.com/acme/plugin/${f.source.commit}/plugin.json`,
      `https://raw.githubusercontent.com/acme/plugin/${f.source.commit}/dist/plugin.mjs`,
      `https://raw.githubusercontent.com/acme/plugin/${f.source.commit}/dist/browser.mjs`,
    ]);
    const cached = await installGitPlugin("example-plugin", f.source, {
      dataDir: f.dataDir,
      offline: true,
    });
    expect(cached.serverPath).toBe(first.serverPath);
  });

  test("rejects a mismatched manifest, browser bundle and unsafe import", async () => {
    const manifestMismatch = fixture();
    expect(
      installGitPlugin(
        "example-plugin",
        {
          ...manifestMismatch.source,
          integrity: `sha512-${digest("wrong", "sha512")}`,
        },
        { dataDir: manifestMismatch.dataDir, fetch: manifestMismatch.fetcher },
      ),
    ).rejects.toThrow("integrity mismatch");

    const browserMismatch = fixture();
    browserMismatch.files.set("dist/browser.mjs", "tampered browser");
    expect(
      installGitPlugin("example-plugin", browserMismatch.source, {
        dataDir: browserMismatch.dataDir,
        fetch: browserMismatch.fetcher,
      }),
    ).rejects.toThrow("differs from manifest");

    const unsafe = fixture();
    const code = 'import "./other.mjs";';
    unsafe.files.set("dist/plugin.mjs", code);
    const manifest = JSON.stringify({
      id: "example-plugin",
      version: "1.0.0",
      apiVersion: 1,
      server: {
        entry: "./dist/plugin.mjs",
        sha256: digest(code, "sha256"),
        bytes: code.length,
      },
    });
    unsafe.files.set("plugin.json", manifest);
    expect(
      installGitPlugin(
        "example-plugin",
        { ...unsafe.source, integrity: `sha512-${digest(manifest, "sha512")}` },
        { dataDir: unsafe.dataDir, fetch: unsafe.fetcher },
      ),
    ).rejects.toThrow("imports another module");
  });

  test("does not open the network for a missing offline activation", async () => {
    const f = fixture();
    expect(
      installGitPlugin("example-plugin", f.source, {
        dataDir: f.dataDir,
        offline: true,
        fetch: f.fetcher,
      }),
    ).rejects.toThrow("unavailable offline");
    expect(f.requested).toEqual([]);
  });
});
