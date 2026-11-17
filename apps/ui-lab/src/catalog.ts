import { coverageCatalog } from "./coverage";
import { pluginCatalog } from "./plugin-catalog";
import { adapterCatalog } from "./adapter-catalog";
import type { CatalogEntry } from "./catalog-types";
import { dashboards } from "./dashboards";
import { foundations } from "./foundations";
import { proCatalog } from "./pro-catalog";
import { sdkCatalog } from "./sdk-catalog";
import { uiCatalog } from "./ui-catalog";
export const catalog: CatalogEntry[] = [
  ...foundations,
  ...coverageCatalog,
  ...uiCatalog,
  ...sdkCatalog,
  ...dashboards,
  ...adapterCatalog,
  ...proCatalog,
  ...pluginCatalog,
];
export const groups = [
  "Foundations",
  "UI components",
  "SDK blocks",
  "Dashboards",
  "Official adapters",
  "Plugins",
  "DSUI Pro",
] as const;
