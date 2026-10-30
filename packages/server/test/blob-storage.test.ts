import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blobDirectory,
  FileBlobStore,
  removeServiceBlobs,
} from "../src/db/blob-storage";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "dsui-blobs-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));

test("round-trips bytes, lists by prefix and leaves no partial files", async () => {
  const blobs = new FileBlobStore(blobDirectory(root, "svc"));
  await blobs.put("runs/1/manifest.json", '{"a":1}');
  await blobs.put("runs/2/manifest.json", new Uint8Array([1, 2, 3]));
  await blobs.put("runs/1/manifest.json", '{"a":2}');

  expect(
    new TextDecoder().decode((await blobs.get("runs/1/manifest.json"))!),
  ).toBe('{"a":2}');
  expect((await blobs.list("runs/1")).map((blob) => blob.key)).toEqual([
    "runs/1/manifest.json",
  ]);
  expect((await blobs.list()).map((blob) => blob.key)).toEqual([
    "runs/1/manifest.json",
    "runs/2/manifest.json",
  ]);
  expect(await blobs.get("runs/1")).toBeNull();
  expect(await blobs.delete("runs/2/manifest.json")).toBe(true);
  expect(await blobs.delete("runs/2/manifest.json")).toBe(false);
  const leftovers = await readdir(join(blobDirectory(root, "svc"), ".tmp"));
  expect(leftovers).toEqual([]);
});

test("a key cannot leave its service directory", async () => {
  const blobs = new FileBlobStore(blobDirectory(root, "svc"));
  for (const key of ["../other/x", "a/../../x", "/etc/passwd", ".tmp/x"])
    await expect(blobs.put(key, "x")).rejects.toThrow("Invalid blob key");
});

test("service ids with separators or dots stay inside the blob root", () => {
  for (const id of ["..", "../x", "a/b", ".", "with space"]) {
    const directory = blobDirectory(root, id);
    expect(directory.startsWith(`${root}/`)).toBe(true);
    expect(directory.slice(root.length + 1)).not.toContain("/");
    expect(directory.slice(root.length + 1)).not.toMatch(/^\.+$/);
  }
  expect(blobDirectory(root, "a/b")).not.toBe(blobDirectory(root, "a_b"));
});

test("removing a service drops only its blobs", async () => {
  const one = new FileBlobStore(blobDirectory(root, "one"));
  const two = new FileBlobStore(blobDirectory(root, "two"));
  await one.put("a", "1");
  await two.put("a", "2");
  await removeServiceBlobs(root, "one");
  expect(await one.get("a")).toBeNull();
  expect(await two.get("a")).not.toBeNull();
});
