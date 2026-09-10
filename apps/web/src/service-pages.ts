import type { HealthStatus } from "@northgraindata/dsui-core";

/** Returns concrete top-level pages suitable for primary sidebar navigation. */
export function navigablePagePaths(paths: readonly string[]): string[] {
  return paths.filter(
    (path) =>
      !path.includes(":") && (path === "/" || path.split("/").length === 2),
  );
}

/** Converts the server health contract into connection-form feedback. */
export function connectionTestMessage(status: HealthStatus): string {
  if (status.status === "healthy")
    return `Connection healthy${status.latencyMs ? ` · ${status.latencyMs}ms` : ""}`;
  return status.detail ?? "Connection could not be verified";
}
