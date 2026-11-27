import { expect, test } from "bun:test";
import { assets, reach } from "./graph";
import { selectAssets } from "./select";

const names = (query: string) =>
  [...(selectAssets(query) ?? [])].map((key) => key.split("/")[1]).sort();

test("a plus reaches upstream or downstream of a term", () => {
  expect(names("churn_model")).toEqual(["churn_model"]);
  expect(names("churn_model+")).toEqual([
    "churn_model",
    "churn_scores",
    "salesforce_account_health",
  ]);
  expect(names("+churn_training_set")).toContain("stripe_subscriptions");
  expect(names("+churn_training_set")).not.toContain("churn_model");
});

test("fields, wildcards and several terms add up", () => {
  expect(names("group:activation")).toHaveLength(6);
  expect(names("stg_hubspot__* or churn_model")).toHaveLength(6);
  expect(selectAssets("kind:dbt")?.size).toBe(
    assets.filter((asset) => asset.kinds.includes("dbt")).length,
  );
  expect(selectAssets("  ")).toBeUndefined();
  expect(names("nothing_like_this")).toEqual([]);
});

test("the graph has no cycle", () => {
  for (const asset of assets)
    expect(reach([asset.key], "up").has(asset.key)).toBe(false);
  expect(assets.some((asset) => reach(asset.deps, "up").has(asset.key))).toBe(
    false,
  );
});
