import type { scopeForPaths } from "./ci-scope";

type Scope = ReturnType<typeof scopeForPaths>;
type Results = Record<"scope" | "lint" | "checks" | "docs" | "docker", string>;

export function selectedChecksPassed(scope: Scope, results: Results): boolean {
  if (results.scope !== "success") return false;
  const selected = {
    lint: scope.run || scope.docs || scope.docker,
    checks: scope.run,
    docs: scope.docs,
    docker: scope.docker,
  };
  return (["lint", "checks", "docs", "docker"] as const).every((job) =>
    selected[job] ? results[job] === "success" : results[job] === "skipped",
  );
}

if (import.meta.main) {
  const { env } = process;
  const passed = selectedChecksPassed(
    {
      run: env.RUN === "true",
      docs: env.RUN_DOCS === "true",
      docker: env.RUN_DOCKER === "true",
    },
    {
      scope: env.SCOPE ?? "",
      lint: env.LINT ?? "",
      checks: env.CHECKS ?? "",
      docs: env.DOCS ?? "",
      docker: env.DOCKER ?? "",
    },
  );
  if (!passed) {
    console.error(
      "Selected CI jobs must succeed; failed, cancelled or unexpectedly skipped jobs block the gate.",
    );
    process.exitCode = 1;
  }
}
