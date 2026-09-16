import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DbtCloudClient,
  DbtCloudRun,
} from "@northgraindata/dsui-adapter-dbt";
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

function cloudClient(
  statuses: DbtCloudRun[],
  logs: unknown = { logs: "cloud log" },
) {
  const calls = { trigger: 0, poll: 0, cancel: 0, log: 0 };
  const client = {
    async triggerJob(_jobId: string | number, _body?: unknown) {
      calls.trigger++;
      const first = statuses[0];
      if (!first) throw new Error("fake Cloud client needs a run");
      return first;
    },
    async getRun() {
      calls.poll++;
      const current = statuses[Math.min(calls.poll, statuses.length - 1)];
      if (!current) throw new Error("fake Cloud client needs a run");
      return current;
    },
    async cancelRun() {
      calls.cancel++;
      const last = statuses.at(-1);
      if (!last) throw new Error("fake Cloud client needs a run");
      return last;
    },
    async getRunLogs() {
      calls.log++;
      return logs;
    },
  } as unknown as DbtCloudClient;
  return { client, calls };
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

  test("triggers an explicit Cloud target, polls to success, and emits safe logs", async () => {
    const { client, calls } = cloudClient(
      [
        { id: 41, status: 1 },
        { id: 41, status: 10, statusMessage: "complete" },
      ],
      { logs: "run finished" },
    );
    let command: string | undefined;
    const output: string[] = [];
    const executor = createDbtRunExecutor({
      secretResolver: { resolve: async () => "unused" },
      cloud: {
        client,
        pollIntervalMs: 0,
        targetResolver: (runRequest) => {
          command = runRequest.command;
          return { jobId: 7, triggerBody: { cause: "dsui" } };
        },
      },
    });
    const result = await executor.execute({
      invocationId: "cloud-success",
      request: request("/tmp/project"),
      signal: new AbortController().signal,
      onOutput: (event) => output.push(event.text),
    });
    expect(command).toBe("run");
    expect(calls).toEqual({ trigger: 1, poll: 1, cancel: 0, log: 1 });
    expect(output).toEqual(["run finished"]);
    expect(result).toMatchObject({
      exitCode: 0,
      providerStatus: {
        provider: "dbt-cloud",
        status: "10",
        message: "complete",
      },
    });
  });

  test("cancels a Cloud run exactly once when its signal aborts", async () => {
    const { client, calls } = cloudClient([{ id: 42, status: 2 }]);
    const controller = new AbortController();
    const executor = createDbtRunExecutor({
      secretResolver: { resolve: async () => "unused" },
      cloud: {
        client,
        pollIntervalMs: 50,
        targetResolver: () => ({ jobId: 8 }),
      },
    });
    const pending = executor.execute({
      invocationId: "cloud-cancel",
      request: request("/tmp/project"),
      signal: controller.signal,
      onOutput: () => {},
    });
    controller.abort();
    await expect(pending).resolves.toMatchObject({ exitCode: 130 });
    expect(calls.cancel).toBe(1);
  });

  test("cancels and reports a bounded Cloud timeout", async () => {
    const { client, calls } = cloudClient([{ id: 43, status: 2 }]);
    const executor = createDbtRunExecutor({
      secretResolver: { resolve: async () => "unused" },
      cloud: {
        client,
        pollIntervalMs: 5,
        timeoutMs: 1,
        targetResolver: () => ({ jobId: 9 }),
      },
    });
    await expect(
      executor.execute({
        invocationId: "cloud-timeout",
        request: { ...request("/tmp/project"), timeoutMs: 1 },
        signal: new AbortController().signal,
        onOutput: () => {},
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(calls.cancel).toBe(1);
  });

  test("maps provider failure and does not emit unsafe log payloads", async () => {
    const token = "cloud-secret";
    const { client } = cloudClient(
      [{ id: 44, status: "error", message: "failed" }],
      { details: { token } },
    );
    const output: string[] = [];
    const executor = createDbtRunExecutor({
      secretResolver: { resolve: async () => token },
      cloud: {
        client,
        targetResolver: () => ({ jobId: 10 }),
      },
    });
    const result = await executor.execute({
      invocationId: "cloud-failure",
      request: {
        ...request("/tmp/project"),
        environment: { TOKEN: { value: token } },
      },
      signal: new AbortController().signal,
      onOutput: (event) => output.push(event.text),
    });
    expect(result.exitCode).toBe(1);
    expect(result.providerStatus).toMatchObject({
      status: "error",
      message: "failed",
    });
    expect(output).toEqual([]);
  });
});
