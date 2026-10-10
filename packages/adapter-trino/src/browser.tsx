import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type * as ReactTypes from "react";
import { Query } from "./components/query-details";
// biome-ignore lint/correctness/noUnusedImports: Classic JSX reads the injected React binding.
import { initializeReact, React } from "./components/react";
import { styles } from "./components/styles";
import { WorkerDetails } from "./components/worker-details";

const propsSchema = z.object({
  view: z.enum(["query", "worker"]),
  queryId: z.string().optional(),
  nodeId: z.string().optional(),
});
function TrinoDetail({ client, node }: ComponentProps) {
  if (node.kind !== "custom") return null;
  const props = propsSchema.parse(node.props.props);
  return (
    <div className="trino">
      <style>{styles}</style>
      {props.view === "query" && props.queryId && (
        <Query key={props.queryId} client={client} queryId={props.queryId} />
      )}
      {props.view === "worker" && props.nodeId && (
        <WorkerDetails
          key={props.nodeId}
          client={client}
          nodeId={props.nodeId}
        />
      )}
    </div>
  );
}
export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return { "trino/detail": TrinoDetail };
}
