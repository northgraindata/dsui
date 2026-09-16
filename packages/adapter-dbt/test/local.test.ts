import { describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDbtLocalExecutor, planDbtCommand } from "../src/index.js";

async function projectDirectory() {
  return mkdtemp(join(tmpdir(), "dsui-dbt-"));
}

describe("dbt local command boundary", () => {
  test.each([
    ["run", ["run", "--project-dir"]],
    ["build", ["build", "--project-dir"]],
    ["test", ["test", "--project-dir"]],
    ["compile", ["compile", "--project-dir"]],
    ["docs-generate", ["docs", "generate", "--project-dir"]],
  ] as const)("plans exact argv for %s", async (command, prefix) => {
    const projectPath = await projectDirectory();
    const targetPath = join(projectPath, "target");
    const plan = planDbtCommand({
      command,
      projectPath,
      profilesDir: join(projectPath, "profiles"),
      profile: "analytics",
      target: "ci",
      targetPath,
      ...(command === "docs-generate"
        ? {}
        : {
            select: ["model.orders", "tag:nightly"],
            exclude: ["model.legacy"],
            vars: { environment: "ci", retries: 2 },
            ...(command === "run" || command === "build"
              ? { fullRefresh: true }
              : {}),
            defer: true,
            state: join(projectPath, "state"),
            ...(command === "test" ? { failFast: true } : {}),
            threads: 4,
          }),
    });

    expect(plan.command).toBe("dbt");
    const canonicalProjectPath = realpathSync(projectPath);
    expect(plan.cwd).toBe(canonicalProjectPath);
    expect(plan.args.slice(0, prefix.length)).toEqual([...prefix]);
    expect(plan.args).toEqual([
      ...prefix,
      canonicalProjectPath,
      "--profiles-dir",
      join(canonicalProjectPath, "profiles"),
      "--profile",
      "analytics",
      "--target",
      "ci",
      "--target-path",
      join(canonicalProjectPath, "target"),
      ...(command === "docs-generate"
        ? []
        : [
            "--select",
            "model.orders",
            "--select",
            "tag:nightly",
            "--exclude",
            "model.legacy",
            "--vars",
            JSON.stringify({ environment: "ci", retries: 2 }),
          ]),
      ...(command === "run" || command === "build" ? ["--full-refresh"] : []),
      ...(command !== "docs-generate" ? ["--defer"] : []),
      ...(command === "docs-generate"
        ? []
        : ["--state", join(canonicalProjectPath, "state")]),
      ...(command === "test" ? ["--fail-fast"] : []),
      ...(command === "docs-generate" ? [] : ["--threads", "4"]),
    ]);
  });

  test("rejects unknown flags and unsafe selector values", async () => {
    const projectPath = await projectDirectory();
    expect(() =>
      planDbtCommand({
        command: "docs-generate",
        projectPath,
        select: ["model.orders"],
      }),
    ).toThrow("Option select is not allowed");
    expect(() =>
      planDbtCommand({
        command: "run",
        projectPath,
        select: ["--profiles-dir", "other"],
      }),
    ).toThrow("must not be empty or begin with '-'");
    expect(() =>
      planDbtCommand({
        command: "run",
        projectPath,
        executable: "sh -c dbt",
      }),
    ).toThrow("Executable is not allowed");
    const unsafeRequest = Object.assign(
      { command: "run" as const, projectPath },
      { args: ["--unsafe"] },
    );
    expect(() => planDbtCommand(unsafeRequest)).toThrow(
      "Unknown dbt option: args",
    );
  });

  test("rejects project escape for cwd, target, and state paths", async () => {
    const projectPath = await projectDirectory();
    for (const field of ["cwd", "targetPath", "state"] as const) {
      expect(() =>
        planDbtCommand({
          command: "run",
          projectPath,
          [field]: join(projectPath, "..", "outside"),
        }),
      ).toThrow(`${field} must be within projectPath`);
    }
  });

  test("resolves and redacts secret environment entries without returning them", async () => {
    const projectPath = await projectDirectory();
    let received:
      | {
          env?: Readonly<Record<string, string | undefined>>;
          sensitiveValues?: readonly string[];
        }
      | undefined;
    const secretResolver = {
      async resolve(secretRef: string) {
        expect(secretRef).toBe("secret/dbt-token");
        return "short-secret";
      },
    };
    const executor = createDbtLocalExecutor({
      secretResolver,
      runner: {
        async run(request) {
          received = request;
          return {
            command: request.command,
            args: request.args ?? [],
            exitCode: 0,
            stdout: "token=short-secret",
            stderr: "",
            durationMs: 1,
          };
        },
      },
    });

    const result = await executor.execute({
      command: "run",
      projectPath,
      environment: {
        DBT_TOKEN: { secretRef: "secret/dbt-token" },
        DBT_TARGET: { value: "ci" },
      },
    });

    expect(received?.env).toEqual({
      DBT_TOKEN: "short-secret",
      DBT_TARGET: "ci",
    });
    expect(received?.sensitiveValues).toEqual(["short-secret"]);
    expect(result.stdout).not.toContain("short-secret");
    expect(JSON.stringify(result)).not.toContain("secret/dbt-token");
  });

  test("passes the caller AbortSignal to the process runner", async () => {
    const projectPath = await projectDirectory();
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    const executor = createDbtLocalExecutor({
      secretResolver: { resolve: async () => "unused" },
      runner: {
        async run(request) {
          signal = request.signal;
          return {
            command: request.command,
            args: request.args ?? [],
            exitCode: 0,
            stdout: "",
            stderr: "",
            durationMs: 0,
          };
        },
      },
    });

    await executor.execute(
      { command: "compile", projectPath },
      controller.signal,
    );
    expect(signal).toBe(controller.signal);
  });
});
