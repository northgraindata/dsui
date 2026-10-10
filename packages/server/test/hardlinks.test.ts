import { expect, test } from "bun:test";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { materializeHardlinks } from "../src/adapters/symlinks";

test("release files keep their contents and mode without sharing SDK cache inodes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-hardlinks-test-"));
  try {
    const root = join(directory, "sdk");
    await mkdir(join(root, "nested"), { recursive: true });
    const cached = join(directory, "cached");
    const first = join(root, "first");
    const second = join(root, "nested", "second");
    await writeFile(cached, "sdk dependency");
    await chmod(cached, 0o755);
    await link(cached, first);
    await link(cached, second);

    await materializeHardlinks(root);

    for (const path of [cached, first, second]) {
      expect((await lstat(path)).nlink).toBe(1);
      expect((await lstat(path)).mode & 0o777).toBe(0o755);
      expect(await readFile(path, "utf8")).toBe("sdk dependency");
    }
    await writeFile(first, "changed");
    expect(await readFile(cached, "utf8")).toBe("sdk dependency");
    expect(await readFile(second, "utf8")).toBe("sdk dependency");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
