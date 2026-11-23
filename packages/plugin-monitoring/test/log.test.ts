import { expect, test } from "bun:test";
import {
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendDiagnostic } from "../src/stores/log.js";

test("diagnostic history appends valid JSON and prunes expired files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-diagnostics-"));
  try {
    const now = Date.now();
    const expired = join(directory, "diagnostic-1-1.log");
    await writeFile(expired, "old\n");
    await utimes(expired, new Date(0), new Date(0));
    await appendDiagnostic(directory, { type: "resource", cpu: 10 }, now);
    await appendDiagnostic(directory, { type: "resource", cpu: 20 }, now + 1);
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    const rows = (await readFile(join(directory, files[0]), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(rows.map((row) => row.cpu)).toEqual([10, 20]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rotation respects both per-file and total byte budgets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-rotation-"));
  try {
    const now = Date.now();
    const day = Math.floor(now / 86400000);
    for (let i = 0; i < 10; i++) {
      const path = join(directory, `diagnostic-${day}-${now - 1000 + i}.log`);
      const file = await open(path, "w");
      await file.truncate(10 * 1024 * 1024);
      await file.close();
      await utimes(path, new Date(now - 1000 + i), new Date(now - 1000 + i));
    }
    await appendDiagnostic(directory, { cpu: 99 }, now);
    const files = await readdir(directory);
    const sizes = await Promise.all(
      files.map(async (file) => (await stat(join(directory, file))).size),
    );
    expect(files).toHaveLength(10);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(
      100 * 1024 * 1024,
    );
    expect(sizes.every((size) => size <= 10 * 1024 * 1024)).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
