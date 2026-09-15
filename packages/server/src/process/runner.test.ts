import { describe, expect, test } from "bun:test";
import { LocalProcessRunner } from "./runner.js";

const cwd = process.cwd();

describe("LocalProcessRunner", () => {
  test("runs an allowed command and returns separated output", async () => {
    const runner = new LocalProcessRunner({
      allowedCommands: [process.execPath],
    });

    const result = await runner.run({
      command: process.execPath,
      args: ["-e", 'console.log("out"); console.error("err")'],
      cwd,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("out");
    expect(result.stderr).toContain("err");
  });

  test("rejects commands outside the allowlist", async () => {
    const runner = new LocalProcessRunner({ allowedCommands: ["dbt"] });

    await expect(
      runner.run({ command: process.execPath, cwd }),
    ).rejects.toMatchObject({
      code: "COMMAND_NOT_ALLOWED",
    });
  });

  test("redacts sensitive values from output and callbacks", async () => {
    const chunks: string[] = [];
    const runner = new LocalProcessRunner({
      allowedCommands: [process.execPath],
    });

    const result = await runner.run({
      command: process.execPath,
      args: ["-e", 'console.log("token=secret-value")'],
      cwd,
      sensitiveValues: ["secret-value"],
      onOutput: ({ text }) => {
        chunks.push(text);
      },
    });

    expect(result.stdout).toContain("[REDACTED]");
    expect(result.stdout).not.toContain("secret-value");
    expect(chunks.join("")).not.toContain("secret-value");
  });

  test("cancels a running process", async () => {
    const controller = new AbortController();
    const runner = new LocalProcessRunner({
      allowedCommands: [process.execPath],
    });
    const promise = runner.run({
      command: process.execPath,
      args: ["-e", "setTimeout(() => {}, 10000)"],
      cwd,
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toMatchObject({
      code: "CANCELLED",
    });
  });

  test("times out a running process", async () => {
    const runner = new LocalProcessRunner({
      allowedCommands: [process.execPath],
    });

    await expect(
      runner.run({
        command: process.execPath,
        args: ["-e", "setTimeout(() => {}, 10000)"],
        cwd,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
