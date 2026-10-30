import type {
  AnyActionDefinition,
  DataSource,
} from "@northgraindata/dsui-adapter-sdk";
import { defineComponent } from "@northgraindata/dsui-adapter-sdk";

/**
 * Rows read from `source` use a fixed shape: `id`, `label`, `dependsOn`,
 * and optionally `group`, `kinds`, `state`, `stateLabel`, `caption`,
 * `description`, `external`, `checkState`, `checkLabel`, and `details`.
 */
export interface AssetGraphProps {
  source: DataSource;
  rowLink?: { path: string; params: Record<string, string> };
  /** Inspector button that runs an action with row fields as input. */
  nodeAction?: {
    label: string;
    action: AnyActionDefinition;
    input: Record<string, string>;
    when?: { field: string; equals: string | number | boolean };
  };
  /** Singular noun for node counts and search, such as "asset" or "op". */
  noun?: string;
  refreshMs?: number;
  emptyMessage?: string;
}

export const AssetGraph = defineComponent<AssetGraphProps>({
  id: "dagster/asset-graph",
  path: "./asset-graph-view.tsx",
});
