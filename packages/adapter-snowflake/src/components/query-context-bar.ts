import {
  defineComponent,
  KeyValue,
  type KeyValueNode,
} from "@northgraindata/dsui-adapter-sdk";

export interface QueryContextBarProps {
  role: string | null;
  warehouse: string | null;
  database: string | null;
  schema: string | null;
}

export const QueryContextBar = defineComponent<
  QueryContextBarProps,
  KeyValueNode
>({
  id: "query-context-bar",
  render: (props) => KeyValue({ title: "Context", data: { ...props } }),
});
