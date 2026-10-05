import { CodeExplorer } from "@northgraindata/dsui-plugin-sdk";
import { route } from "../model";
import { React } from "./react";
import { type Props, treeSchema, useResource } from "./shared";

export function Explorer({
  client,
  renderNode,
  serviceId,
  connectionId,
  path,
}: Pick<Props, "client" | "renderNode"> & {
  serviceId: string;
  connectionId: string;
  path: string;
}) {
  const tree = useResource(client, "tree", { serviceId, connectionId });
  const data = tree.data ? treeSchema.parse(tree.data) : undefined;
  return (
    <section>
      <button
        className="cr-back"
        type="button"
        onClick={() => client.navigate?.(route(serviceId))}
      >
        ← Connection settings
      </button>
      {(tree.error || data?.connection.error) && (
        <p role="alert" className="cr-error">
          {tree.error ?? data?.connection.error}
        </p>
      )}
      {data ? (
        renderNode(
          client,
          CodeExplorer({
            title: data.connection.name,
            version: data.connection.version ?? undefined,
            files: data.files,
            path,
            basePath: route(serviceId, connectionId),
            file: { resourceId: "file", input: { serviceId, connectionId } },
            emptyMessage: data.connection.version
              ? "No files in this folder."
              : "Waiting for first fetch…",
          }),
        )
      ) : (
        <p>Loading files…</p>
      )}
    </section>
  );
}
