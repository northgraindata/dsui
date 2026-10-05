import { route } from "../model";
import { Code } from "./code";
import { React } from "./react";
import { type Client, fileSchema, treeSchema, useResource } from "./shared";
export function Explorer({
  client,
  serviceId,
  connectionId,
  path,
}: {
  client: Client;
  serviceId: string;
  connectionId: string;
  path: string;
}) {
  const tree = useResource(client, "tree", { serviceId, connectionId });
  const parsedTree = tree.data ? treeSchema.parse(tree.data) : undefined;
  const selected = parsedTree?.files.find((file) => file.path === path);
  const file = useResource(
    client,
    "file",
    { serviceId, connectionId, path },
    Boolean(selected),
    parsedTree?.connection.version ?? "",
  );
  const parsedFile = file.data ? fileSchema.parse(file.data) : undefined;
  const base =
    path && !selected
      ? `${path}/`
      : path.includes("/")
        ? path.slice(0, path.lastIndexOf("/") + 1)
        : "";
  const entries = new Map<string, boolean>();
  for (const entry of parsedTree?.files ?? []) {
    if (!entry.path.startsWith(base)) continue;
    const tail = entry.path.slice(base.length);
    entries.set(tail.split("/")[0], tail.includes("/"));
  }
  return (
    <section>
      <div className="cr-row">
        <button
          type="button"
          onClick={() => client.navigate?.(route(serviceId))}
        >
          Settings
        </button>
        <h2>{parsedTree?.connection.name ?? "Code explorer"}</h2>
        {parsedTree && (
          <span className="cr-status">{parsedTree.connection.status}</span>
        )}
      </div>
      <nav className="cr-row" aria-label="File breadcrumbs">
        <button
          type="button"
          onClick={() => client.navigate?.(route(serviceId, connectionId))}
        >
          Files
        </button>
        {path
          .split("/")
          .filter(Boolean)
          .map((part, index, all) => (
            <button
              type="button"
              key={all.slice(0, index + 1).join("/")}
              onClick={() =>
                client.navigate?.(
                  route(
                    serviceId,
                    connectionId,
                    all.slice(0, index + 1).join("/"),
                  ),
                )
              }
            >
              {part}
            </button>
          ))}
      </nav>
      {(tree.error || file.error) && (
        <p role="alert" className="cr-error">
          {tree.error ?? file.error}
        </p>
      )}
      {parsedTree?.connection.error && (
        <p className="cr-error">{parsedTree.connection.error}</p>
      )}
      <div className="cr-explorer">
        <aside aria-label="Repository files">
          {base && (
            <button
              type="button"
              onClick={() =>
                client.navigate?.(
                  route(
                    serviceId,
                    connectionId,
                    base.replace(/\/$/, "").split("/").slice(0, -1).join("/"),
                  ),
                )
              }
            >
              ../
            </button>
          )}
          {[...entries]
            .sort(
              ([a, ad], [b, bd]) =>
                Number(bd) - Number(ad) || a.localeCompare(b),
            )
            .map(([name, directory]) => (
              <button
                type="button"
                key={name}
                className={path === `${base}${name}` ? "cr-selected" : ""}
                onClick={() =>
                  client.navigate?.(
                    route(serviceId, connectionId, `${base}${name}`),
                  )
                }
              >
                {directory ? "▸ " : ""}
                {name}
                {directory ? "/" : ""}
              </button>
            ))}
          {parsedTree && !parsedTree.files.length && (
            <p>
              {parsedTree.connection.version
                ? "No files in this folder."
                : "Waiting for first fetch…"}
            </p>
          )}
        </aside>
        <main>
          {parsedFile ? (
            <Code file={parsedFile} />
          ) : (
            <p>
              {selected
                ? "Loading file…"
                : path && !entries.size
                  ? "File or folder not found."
                  : "Select a file to view its contents."}
            </p>
          )}
        </main>
      </div>
    </section>
  );
}
