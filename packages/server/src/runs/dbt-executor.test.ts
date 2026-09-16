import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessRunRequest } from "@northgraindata/dsui-process-runner";
import type { StartRunRequest } from "./contracts.js";
import { createDbtRunExecutor } from "./dbt-executor.js";

async function project() {
  const path = await mkdtemp(join(tmpdir(), "dsui-server-dbt-"));
  await mkdir(join(path, "target"));
  return path;
}

function request(projectPath: string): StartRunRequest {
  return {
    command: "run",
    project: { path: projectPath },
    profile: { name: "analytics", target: "ci" },
    args: {
      select: ["model.orders"],
      vars: '{"environment":"ci"}',
      fullRefresh: true,
      threads: "2",
    },
    environment: {
      DBT_TOKEN: { secretRef: "secret/dbt-token" },
      DBT_ENV: { value: "ci" },
    },
    timeoutMs: 1234,
    idempotencyKey: "start-key",
  };
}

describe("server dbt run executor", () => {
  test("maps request fields to safe argv, resolves secrets, and translates artifacts", async () => {
    const projectPath = await project();
    await writeFile(join(projectPath, "target", "manifest.json"), "{}");
    let received: ProcessRunRequest | undefined;
    const output: string[] = [];
    const executor = createDbtRunExecutor({
      secretResolver: {
        async resolve(ref) {
          expect(ref).toBe("secret/dbt-token");
          return "token-value";
        },
      },
      runner: {
        async run(input) {
          received = input;
          input.onOutput?.({ stream: "stdout", text: "token=[REDACTED]" });
          return {
            command: input.command,
            args: input.args ?? [],
            exitCode: 0,
            stdout: "token=[REDACTED]",
            stderr: "",
            durationMs: 7,
          };
        },
      },
    });

    const result = await executor.execute({
      invocationId: "invocation-1",
      request: request(projectPath),
      signal: new AbortController().signal,
      onOutput: (event) => output.push(event.text),
    });

    expect(received?.command).toBe("dbt");
    expect(received?.args).toEqual([
      "run",
      "--project-dir",
      await realpath(projectPath),
      "--profile",
      "analytics",
      "--target",
      "ci",
      "--select",
      "model.orders",
      "--vars",
      '{"environment":"ci"}',
      "--full-refresh",
      "--threads",
      "2",
    ]);
    expect(received?.env).toEqual({ DBT_TOKEN: "token-value", DBT_ENV: "ci" });
    expect(received?.sensitiveValues).toEqual(["token-value"]);
    expect(received?.timeoutMs).toBe(1234);
    expect(output).toEqual(["token=[REDACTED]"]);
    expect(result).toMatchObject({ exitCode: 0, durationMs: 7 });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts?.[0]).toMatchObject({
      artifactId: "manifest",
      invocationId: "invocation-1",
      location: { kind: "local" },
    });
  });

  test("passes cancellation through without shell execution", async () => {
    const projectPath = await project();
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    const executor = createDbtRunExecutor({
      secretResolver: { resolve: async () => "unused" },
      runner: {
        async run(input) {
          signal = input.signal;
          return {
            command: input.command,
            args: input.args ?? [],
            exitCode: 0,
            stdout: "",
            stderr: "",
            durationMs: 0,
          };
        },
      },
    });
    await executor.execute({
      invocationId: "invocation-2",
      request: {
        ...request(projectPath),
        command: "docs_generate",
        args: undefined,
      },
      signal: controller.signal,
      onOutput: () => {},
    });
    expect(signal).toBe(controller.signal);
  });

  test("rejects upload projects and cloud requests explicitly", async () => {
    const executor = createDbtRunExecutor({
      secretResolver: { resolve: async () => "unused" },
      runner: {
        run: async () => {
          throw new Error("must not run");
        },
      },
    });
    const base = {
      invocationId: "invocation-3",
      signal: new AbortController().signal,
      onOutput: () => {},
    };
    await expect(
      executor.execute({
        ...base,
        request: {
          ...request("/tmp/project"),
          project: { uploadId: "upload-1" },
        },
      }),
    ).rejects.toThrow("uploadId");
    await expect(
      executor.execute({
        ...base,
        request: Object.assign(request("/tmp/project"), { cloud: true }),
      }),
    ).rejects.toThrow("Cloud execution");
  });
});
