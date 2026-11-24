import type { HealthStatus } from "@northgraindata/dsui-core";

/** Returns concrete top-level pages suitable for primary sidebar navigation. */
export function navigablePagePaths(paths: readonly string[]): string[] {
  return paths.filter(
    (path) =>
      !path.includes(":") && (path === "/" || path.split("/").length === 2),
  );
}

export function pageLabel(path: string) {
  if (path === "/") return "Overview";
  if (path === "/data") return "Explorer";
  const label =
    path.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Overview";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Converts the server health contract into connection-form feedback. */
export function connectionTestMessage(status: HealthStatus): string {
  if (status.status === "healthy")
    return `Connection healthy${status.latencyMs ? ` · ${status.latencyMs}ms` : ""}`;
  return status.detail ?? "Connection could not be verified";
}
