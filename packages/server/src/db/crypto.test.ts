import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConnectionCipher, resolveMasterKey } from "./crypto";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), "dsui-master-key-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    chmodSync(path, 0o700);
  }
});

describe("resolveMasterKey", () => {
  test("generates and persists a valid local key", () => {
    const dataDir = temporaryDirectory();
    const first = resolveMasterKey(dataDir, undefined);
    const second = resolveMasterKey(dataDir, undefined);

    expect(first).toHaveLength(44);
    expect(second).toBe(first);
    expect(readFileSync(join(dataDir, ".master-key"), "utf8")).toBe(
      `${first}\n`,
    );
    expect(statSync(join(dataDir, ".master-key")).mode & 0o777).toBe(0o600);
    expect(() => new ConnectionCipher(first)).not.toThrow();
  });

  test("uses the explicit key without replacing the persisted key", () => {
    const dataDir = temporaryDirectory();
    const localKey = resolveMasterKey(dataDir, undefined);
    const explicitKey = Buffer.alloc(32, 7).toString("base64");

    expect(resolveMasterKey(dataDir, explicitKey)).toBe(explicitKey);
    expect(resolveMasterKey(dataDir, undefined)).toBe(localKey);
  });

  test("rejects an invalid explicit key", () => {
    expect(() => resolveMasterKey(temporaryDirectory(), "not-a-key")).toThrow(
      "DSUI_MASTER_KEY must be a base64-encoded 32-byte key",
    );
  });
});
