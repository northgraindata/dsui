import { expect, test } from "bun:test";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
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
