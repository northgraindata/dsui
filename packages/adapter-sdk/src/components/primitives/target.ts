import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

/** Publish a stable, page-unique element id for contextual overlays. */
export interface TargetProps {
  id: string;
  content: PageNode | readonly PageNode[];
}
export const Target = defineComponent<TargetProps>({
  id: "target",
  path: "./ui/target",
});
