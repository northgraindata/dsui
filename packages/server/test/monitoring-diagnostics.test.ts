import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleAll } from "../../plugin-monitoring/src/resources/series.js";
import { stopRuntimeMetrics } from "../../plugin-monitoring/src/runtime-metrics.js";
import {
  readWindow,
  recentRuntime,
} from "../../plugin-monitoring/src/stores/history.js";
import { createPluginStorage } from "../src/plugins/storage.js";

test("continuous samples use host-managed storage and survive reopening it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-monitoring-"));
  const storage = createPluginStorage(directory, "monitoring");
  try {
    await sampleAll(storage, [], { operations: [], droppedOperations: 0 });
    await sampleAll(storage, [], { operations: [], droppedOperations: 0 });
    expect(readWindow(storage, "cpu", 3600, "1h").sampleCount).toBeGreaterThan(
      0,
    );
    expect(recentRuntime(storage)[0]?.metrics.processRssBytes).toBeGreaterThan(
      0,
    );
    storage.close();
    const reopened = createPluginStorage(directory, "monitoring");
    try {
      expect(recentRuntime(reopened).length).toBeGreaterThan(0);
    } finally {
      reopened.close();
    }
    const logDirectory = join(directory, "plugins", "monitoring");
    const log = (await readdir(logDirectory)).find((file) =>
      file.endsWith(".log"),
    );
    expect(log).toBeDefined();
    const rows = (await readFile(join(logDirectory, log ?? ""), "utf8"))
      .trim()
      .split("\n");
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[1] ?? "{}").processCpuPercent).toBeNumber();
  } finally {
    storage.close();
    stopRuntimeMetrics();
    await rm(directory, { recursive: true, force: true });
  }
});
