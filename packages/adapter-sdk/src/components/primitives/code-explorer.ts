import type { ResourceReference } from "../../resource";
import { defineComponent } from "../define";

export interface CodeExplorerFile {
  path: string;
  size?: number;
}
export interface CodeExplorerContent {
  content?: string | null;
  size?: number;
  reason?: string | null;
  language?: string | null;
}
export interface CodeExplorerProps {
  files: readonly CodeExplorerFile[];
  /** The selected file or directory, relative to the source root. */
  path?: string;
  /** The component adds the selected path to this reference's input. */
  file: ResourceReference;
  /** Relative host navigation prefix; each path segment is URL encoded. */
  basePath: string;
  title?: string;
  version?: string;
  emptyMessage?: string;
}
export const CodeExplorer = defineComponent<CodeExplorerProps>({
  id: "code-explorer",
  path: "./ui/code-explorer",
});
