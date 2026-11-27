import type { RendererClient } from "@northgraindata/dsui-renderer";
import type { Scenario } from "@northgraindata/dsui-ui-fixtures";
import { answerAction, answerResource } from "./answers";
import type { FixtureData } from "./data";

/** Serves fixture data through the same seam the product uses for adapters. */
export function fixtureClient(
  data: FixtureData,
  scenario: Scenario,
  navigate: (destination: string) => void,
): RendererClient {
  return {
    connection: { name: "Fixture", endpoint: "fixture://local" },
    executeResource: (reference) =>
      answerResource(data, scenario, reference.resourceId, reference.input),
    executeAction: (reference) =>
      answerAction(data, scenario, reference.actionId),
    navigate,
  };
}
