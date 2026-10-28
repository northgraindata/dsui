import {
  defineComponent,
  definePage,
  type PluginContext,
} from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "../config.js";

type HealthContext = PluginContext<HealthConfig>;

const Overview = defineComponent({
  id: "health/overview",
  path: "./browser.tsx",
});
const Service = defineComponent<{ serviceId: string }>({
  id: "health/service",
  path: "./browser.tsx",
});
const Incidents = defineComponent({
  id: "health/incidents",
  path: "./browser.tsx",
});
const Incident = defineComponent<{ incidentId: string }>({
  id: "health/incident",
  path: "./browser.tsx",
});

export const overviewPage = definePage<"/health", HealthContext>({
  path: "/health",
  render: () => [Overview()],
});

export const servicePage = definePage<
  "/health/services/:serviceId",
  HealthContext
>({
  path: "/health/services/:serviceId",
  render: ({ params }) => [Service({ serviceId: params.serviceId })],
});

export const incidentsPage = definePage<"/health/incidents", HealthContext>({
  path: "/health/incidents",
  render: () => [Incidents()],
});

export const incidentPage = definePage<
  "/health/incidents/:incidentId",
  HealthContext
>({
  path: "/health/incidents/:incidentId",
  render: ({ params }) => [Incident({ incidentId: params.incidentId })],
});
