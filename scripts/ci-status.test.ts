import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { selectedChecksPassed } from "./ci-status";

const success = {
  scope: "success",
  lint: "success",
  checks: "success",
  docs: "success",
  docker: "success",
};
const all = { run: true, docs: true, docker: true };

test("selected jobs must succeed, including after failure or cancellation", () => {
  expect(selectedChecksPassed(all, success)).toBe(true);
  for (const job of ["scope", "lint", "checks", "docs", "docker"] as const)
    for (const result of ["failure", "cancelled", "skipped", ""])
      expect(selectedChecksPassed(all, { ...success, [job]: result })).toBe(
        false,
      );
});

test("docs-only and unaffected changes allow only intentional skips", () => {
  expect(
    selectedChecksPassed(
      { run: false, docs: true, docker: false },
      { ...success, checks: "skipped", docker: "skipped" },
    ),
  ).toBe(true);
  expect(
    selectedChecksPassed(
      { run: false, docs: true, docker: false },
      { ...success, lint: "skipped", checks: "skipped", docker: "skipped" },
    ),
  ).toBe(false);
  expect(
    selectedChecksPassed(
      { run: false, docs: false, docker: false },
      {
        scope: "success",
        lint: "skipped",
        checks: "skipped",
        docs: "skipped",
        docker: "skipped",
      },
    ),
  ).toBe(true);
});

test("workflow gates downstream work on lint and always reports final status", () => {
  const workflow = parse(
    readFileSync(".github/workflows/ci-layer.yml", "utf8"),
  );
  for (const id of ["checks", "docs", "docker"]) {
    expect(workflow.jobs[id].needs).toContain("lint");
    expect(workflow.jobs[id].if).toContain("needs.lint.result == 'success'");
  }
  expect(
    workflow.jobs.lint.steps.some(
      (step: { run?: string }) => step.run === "bun run lint",
    ),
  ).toBe(true);
  expect(workflow.jobs.checks.strategy["fail-fast"]).toBe(true);
  expect(workflow.jobs.checks.strategy.matrix.task).not.toContain("lint");
  expect(workflow.jobs.status.if).toBe("always()");
  expect(workflow.jobs.status.needs).toContain("lint");
  expect(workflow.jobs.status.name).toContain("inputs.layer");
  expect(JSON.stringify(workflow)).not.toContain("continue-on-error");
});

test("product release cannot package or publish past a lint failure", () => {
  const workflow = parse(readFileSync(".github/workflows/release.yml", "utf8"));
  const steps = workflow.jobs.verify.steps;
  const lint = steps.findIndex(
    (step: { run?: string }) => step.run === "bun run lint",
  );
  const pack = steps.findIndex(
    (step: { name?: string }) => step.name === "Build npm package",
  );
  expect(lint).toBeGreaterThan(-1);
  expect(lint).toBeLessThan(pack);
  expect(workflow.jobs.publish.needs).toBe("verify");
});

test("status command exits nonzero after a controlled lint failure", () => {
  const result = Bun.spawnSync([process.execPath, "scripts/ci-status.ts"], {
    env: {
      RUN: "true",
      RUN_DOCS: "true",
      RUN_DOCKER: "true",
      SCOPE: "success",
      LINT: "failure",
      CHECKS: "skipped",
      DOCS: "skipped",
      DOCKER: "skipped",
    },
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("block the gate");
});
