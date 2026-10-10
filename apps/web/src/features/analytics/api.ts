import { ApiError } from "../../api";

export type ChartType = "metric" | "line" | "bar" | "table";
export interface ModuleDefinition {
  name: string;
  subfolder?: string;
  title: string;
  description: string;
  source: {
    serviceId: string;
    resourceId: string;
    input: Record<string, unknown>;
    sqlFile?: string;
    rowsPath: string;
  };
  chart: { type: ChartType; x: string; y: string; unit: string };
  styles: {
    accentColor: string;
    height: "compact" | "regular" | "tall";
    showGrid: boolean;
  };
}
export interface DashboardDefinition {
  name: string;
  title: string;
  description: string;
  styles: { columns: 1 | 2; spacing: "compact" | "regular" | "relaxed" };
  modules: Array<{
    module: string;
    subfolder?: string;
    width: "half" | "full";
  }>;
}
export type Saved<T> = T & { revision: string };
export type ResourceOption = {
  id: string;
  inputSchema?: Record<string, unknown>;
};

async function analyticsRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/v1/analytics/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body: { message?: string } = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? response.statusText, response.status);
  }
  return response.json() as Promise<T>;
}

export const listModules = () =>
  analyticsRequest<Array<Saved<ModuleDefinition>>>("modules");
export const listDashboards = () =>
  analyticsRequest<Array<Saved<DashboardDefinition>>>("dashboards");
export const listResources = (serviceId: string) =>
  analyticsRequest<ResourceOption[]>(
    `resources/${encodeURIComponent(serviceId)}`,
  );
export const saveModule = (
  definition: ModuleDefinition,
  expectedRevision: string | null,
) =>
  analyticsRequest<Saved<ModuleDefinition>>("modules", {
    method: "PUT",
    body: JSON.stringify({ definition, expectedRevision }),
  });
export const saveDashboard = (
  definition: DashboardDefinition,
  expectedRevision: string | null,
) =>
  analyticsRequest<Saved<DashboardDefinition>>("dashboards", {
    method: "PUT",
    body: JSON.stringify({ definition, expectedRevision }),
  });
