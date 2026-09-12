import type { DataSource } from "../../resource";
import { defineComponent } from "../define";

export type ValueFormat = "text" | "number" | "bytes";

export interface ValueProps {
  source?: DataSource;
  field: string;
  format?: ValueFormat;
  fallback?: string;
}

export interface ValueNode {
  readonly kind: "value";
  readonly props: ValueProps;
}

export const Value = defineComponent<ValueProps, ValueNode>({
  id: "value",
  render: (props) => ({
    kind: "value",
    props: { ...props, format: props.format ?? "text" },
  }),
});
