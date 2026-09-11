import { defineComponent } from "../define";
import type { DataSource } from "../../resource";

export interface KeyValueProps {
  title?: string;
  source?: DataSource;
  data?: Readonly<Record<string, unknown>>;
}

export interface KeyValueNode {
  readonly kind: "key-value";
  readonly props: KeyValueProps;
}

export const KeyValue = defineComponent<KeyValueProps, KeyValueNode>({
  id: "key-value",
  render: (props) => ({ kind: "key-value", props: { ...props } }),
});
