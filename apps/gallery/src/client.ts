import type { RendererClient } from "@northgraindata/dsui-renderer";
import type { Scenario } from "@northgraindata/dsui-ui-fixtures";

/** Serves fixture data through the same seam the product uses for adapters. */
export function fixtureClient(
  resources: Record<string, unknown>,
  scenario: Scenario,
): RendererClient {
  return {
    connection: { name: "Fixture", endpoint: "fixture://local" },
    executeResource(reference) {
      if (scenario === "loading") return new Promise<never>(() => undefined);
      if (scenario === "error")
        return Promise.reject(new Error("The source is unavailable."));
      if (!(reference.resourceId in resources))
        return Promise.reject(
          new Error(`No fixture for resource ${reference.resourceId}`),
        );
      return Promise.resolve(structuredClone(resources[reference.resourceId]));
    },
    executeAction: () => Promise.resolve({ status: "success" }),
    navigate: () => undefined,
  };
}
