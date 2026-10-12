import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContext } from "../src/context";
import { dbtHealth } from "../src/health";
import { createDbtLocalClient } from "../src/local";

test("local artifact context does not run dbt; health still detects a missing executable", async () => {
  const ctx = await createContext({
    method: "local",
    projectPath: tmpdir(),
    executable: "/missing-dsui-test-dbt",
  });
  expect(ctx.local).toBeDefined();
  expect((await dbtHealth(ctx)).status).toBe("unavailable");
});

test("successful version probes are cached within a client and aborted probes cannot use the cache", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-dbt-version-"));
  const executable = join(directory, "dbt");
  try {
    await writeFile(
      executable,
      '#!/bin/sh\nprintf "call\\n" >> "$0.calls"\nprintf "fake dbt version\\n"\n',
      { mode: 0o700 },
    );
    const client = createDbtLocalClient({
      method: "local",
      projectPath: directory,
      executable,
    });
    expect(await client.version()).toBe("fake dbt version");
    expect(await client.version()).toBe("fake dbt version");
    expect(await readFile(`${executable}.calls`, "utf8")).toBe("call\n");
    const controller = new AbortController();
    controller.abort();
    await expect(client.version(controller.signal)).rejects.toThrow();
    const fresh = createDbtLocalClient({
      method: "local",
      projectPath: directory,
      executable,
    });
    await fresh.version();
    expect(await readFile(`${executable}.calls`, "utf8")).toBe("call\ncall\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed version probes are not cached", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-dbt-failure-"));
  const executable = join(directory, "dbt");
  try {
    await writeFile(executable, '#!/bin/sh\nprintf "broken\\n" >&2\nexit 1\n', {
      mode: 0o700,
    });
    const client = createDbtLocalClient({
      method: "local",
      projectPath: directory,
      executable,
    });
    await expect(client.version()).rejects.toThrow("broken");
    await writeFile(executable, '#!/bin/sh\nprintf "repaired\\n"\n', {
      mode: 0o700,
    });
    expect(await client.version()).toBe("repaired");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
