import type { Scenario } from "@northgraindata/dsui-ui-fixtures";
import type { FixtureData } from "./data";

/**
 * How a data scenario answers requests. The page-only view and the application
 * shell share this, so a scenario behaves the same in both.
 */
const UNAVAILABLE = "The source is unavailable.";

/** Long enough to see a running state after pressing a button. */
const ACTION_DELAY_MS = 350;

const never = () => new Promise<never>(() => undefined);

export function answerResource(
  data: FixtureData,
  scenario: Scenario,
  resourceId: string,
): Promise<unknown> {
  if (scenario === "loading") return never();
  if (scenario === "error") return Promise.reject(new Error(UNAVAILABLE));
  if (!(resourceId in data.resources))
    return Promise.reject(new Error(`No fixture for resource ${resourceId}`));
  return Promise.resolve(structuredClone(data.resources[resourceId]));
}

export type ActionAnswer =
  | { status: "success"; data: unknown }
  | { status: "error"; message: string };

export async function answerAction(
  data: FixtureData,
  scenario: Scenario,
  actionId: string,
): Promise<ActionAnswer> {
  if (scenario === "loading") return never();
  await new Promise((done) => setTimeout(done, ACTION_DELAY_MS));
  if (scenario === "error") return { status: "error", message: UNAVAILABLE };
  return {
    status: "success",
    data: structuredClone(data.actions[actionId] ?? {}),
  };
}
