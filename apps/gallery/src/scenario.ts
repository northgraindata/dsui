import { SCENARIOS, type Scenario } from "@northgraindata/dsui-ui-fixtures";

export function toScenario(value: string | null): Scenario {
  return SCENARIOS.find((scenario) => scenario === value) ?? "default";
}
