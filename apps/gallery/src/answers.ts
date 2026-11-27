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
  input?: unknown,
): Promise<unknown> {
  if (scenario === "loading") return never();
  if (scenario === "error") return Promise.reject(new Error(UNAVAILABLE));
  if (!(resourceId in data.resources))
    return Promise.reject(new Error(`No fixture for resource ${resourceId}`));
  return Promise.resolve(
    onePage(structuredClone(data.resources[resourceId]), input),
  );
}

/** A paged resource returns the page that was asked for, of its fixture. */
function onePage(value: unknown, input: unknown): unknown {
  const { limit, offset } = (input ?? {}) as {
    limit?: unknown;
    offset?: unknown;
  };
  const { items } = (value ?? {}) as { items?: unknown };
  if (typeof limit !== "number" || typeof offset !== "number") return value;
  if (!Array.isArray(items)) return value;
  return { items: items.slice(offset, offset + limit), total: items.length };
}

export type ActionAnswer =
  | { status: "success"; data: unknown }
  | { status: "error"; message: string };

declare global {
  interface Window {
    /** Every action the page asked to run, for tests and debugging. */
    galleryActions?: string[];
  }
}

export async function answerAction(
  data: FixtureData,
  scenario: Scenario,
  actionId: string,
): Promise<ActionAnswer> {
  window.galleryActions = [...(window.galleryActions ?? []), actionId];
  if (scenario === "loading") return never();
  await new Promise((done) => setTimeout(done, ACTION_DELAY_MS));
  if (scenario === "error") return { status: "error", message: UNAVAILABLE };
  return {
    status: "success",
    data: structuredClone(data.actions[actionId] ?? {}),
  };
}
