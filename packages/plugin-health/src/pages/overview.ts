import {
  definePage,
  PageHeader,
  type PluginContext,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { healthPanel } from "../components/health-panel.js";
import type { Health, ServiceSummary } from "../context.js";
import { type HealthSummary, serviceHealth } from "../resources/health.js";

/** One row of the health panel: a service, plus how it answered. */
type HealthPanelRow = ServiceSummary & { health: Health };

export type HealthPageContext = {
  readonly services: {
    list(input?: {
      readonly cursor?: string;
      readonly limit?: number;
    }): Promise<{ readonly items: readonly ServiceSummary[] }>;
    probe(
      id: string,
      options?: { readonly timeoutMs?: number },
    ): ReturnType<HealthProbe>;
  };
  readonly config: { readonly timeoutMs: number };
};

type HealthProbe = () => Promise<{
  id: string;
  health: Health;
  detail?: string;
  latencyMs?: number;
} | null>;

function summary(counts: Record<Health, number>): string {
  return [
    `${counts.healthy} healthy`,
    `${counts.warning} warning`,
    `${counts.unavailable} unavailable`,
  ].join(" · ");
}

/**
 * Health overview page.
 *
 * Renders from a single batched probe of every service so the page does not
 * trigger one external call per card.
 */
/** The plugin's own config, as the health page reads it. */
export type HealthConfig = {
  timeoutMs: number;
  maxServices: number;
};

export const healthOverviewPage = definePage<
  "/health",
  PluginContext<HealthConfig>
>({
  path: "/health",
  render: async ({ resource }) => {
    const { items: results, counts } = (await resource(
      serviceHealth,
    )) as HealthSummary;
    return renderOverview({ results, counts });
  },
});

function renderOverview(input: {
  results: HealthPanelRow[];
  counts: HealthSummary["counts"];
}) {
  const { counts, results } = input;
  return [
    PageHeader({
      title: "Service health",
      description: summary(counts),
    }),
    Section({ title: "Services", content: healthPanel(results) }),
  ];
}
