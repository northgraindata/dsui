import type { ReactNode } from "react";
import type { Scenario } from "./fixtures";
export interface Example {
  id: string;
  title: string;
  scenario?: Scenario;
  render: (scenario: Scenario) => ReactNode;
  code?: string;
}
export interface CatalogEntry {
  id: string;
  title: string;
  group:
    | "Foundations"
    | "UI components"
    | "SDK blocks"
    | "Dashboards"
    | "Official adapters"
    | "Plugins"
    | "DSUI Pro";
  description: string;
  source: string;
  examples: Example[];
  note?: string;
}
