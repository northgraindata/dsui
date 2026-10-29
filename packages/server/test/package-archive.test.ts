import { expect, test } from "bun:test";
import {
  extractTar,
  MAX_ARCHIVE_BYTES,
  MAX_PACKAGE_BYTES,
  readResponseBytes,
} from "../src/adapters/build";

function tar(entries: Array<{ path: string; size: number }>): Uint8Array {
  const length = entries.reduce(
    (total, entry) => total + 512 + Math.ceil(entry.size / 512) * 512,
    1024,
  );
  const archive = Buffer.alloc(length);
  let offset = 0;
  for (const entry of entries) {
    archive.write(`repo-main/${entry.path}`, offset);
    archive.write(entry.size.toString(8).padStart(11, "0"), offset + 124);
    archive[offset + 156] = 48;
    offset += 512 + Math.ceil(entry.size / 512) * 512;
  }
  return archive;
}

test("repository files outside the package do not consume its size budget", () => {
  const archive = tar([
    { path: "site/screenshot.png", size: MAX_PACKAGE_BYTES + 1 },
    { path: "packages/adapter/package.json", size: 2 },
    { path: "packages/adapter-other/index.ts", size: 100 },
  ]);
  const files = extractTar(archive, "owner/repo", "packages/adapter");
  expect([...files.keys()]).toEqual(["packages/adapter/package.json"]);
  expect(files.get("packages/adapter/package.json")?.byteLength).toBe(2);
});

test("oversized selected packages are still rejected", () => {
  const archive = tar([
    { path: "packages/adapter/source.ts", size: MAX_PACKAGE_BYTES + 1 },
  ]);
  expect(() => extractTar(archive, "owner/repo", "packages/adapter")).toThrow(
    "Selected package expands beyond size limit",
  );
});

test("selected package paths cannot escape the extraction root", () => {
  expect(() => extractTar(tar([]), "owner/repo", "../adapter")).toThrow(
    "unsafe path segment",
  );
  expect(() =>
    extractTar(
      tar([{ path: "packages/adapter/../escape", size: 1 }]),
      "owner/repo",
      "packages/adapter",
    ),
  ).toThrow("unsafe path segment");
});

test("repository downloads allow 80 MiB while retaining a separate cap", async () => {
  expect(MAX_ARCHIVE_BYTES).toBeGreaterThanOrEqual(80 * 1024 * 1024);
  await expect(
    readResponseBytes(new Response(new Uint8Array(5)), 4, "Repository"),
  ).rejects.toThrow("Repository exceeds size limit");
});
