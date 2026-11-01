import { describe, expect, test } from "bun:test";
import { defaultHostCommand, isEmbedded } from "../src/adapters/loader";

describe("which files a host can be started from", () => {
  test("a path inside a compiled binary is not a file on disk", () => {
    expect(isEmbedded("/$bunfs/root/dsui")).toBe(true);
    expect(isEmbedded("B:/~BUN/root/dsui.exe")).toBe(true);
  });

  test("a source file is", () => {
    expect(isEmbedded("/app/packages/server/src/adapter-host.ts")).toBe(false);
  });

  test("a source checkout starts the host from its script", () => {
    const { command, args } = defaultHostCommand("/data/adapter.mjs");
    expect(command).toBe(process.execPath);
    expect(args[0]).toMatch(/adapter-host\.ts$/u);
    expect(args.slice(1, 4)).toEqual([
      "adapter-host",
      "--bundle",
      "/data/adapter.mjs",
    ]);
  });
});
