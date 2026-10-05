import type { z } from "zod";
import { type Connection, route } from "../model";
import { RepositoryForm } from "./form";
import { React } from "./react";
import { action, type Client, type overviewSchema, timestamp } from "./shared";
export function Settings({
  service,
  client,
  providers,
  refresh,
}: {
  service: z.infer<typeof overviewSchema>["services"][number];
  client: Client;
  providers: z.infer<typeof overviewSchema>["providers"];
  refresh: () => void;
}) {
  const [editing, setEditing] = React.useState<Connection | "new">();
  const [error, setError] = React.useState<string>();
  const [deleting, setDeleting] = React.useState<string>();
  const perform = async (id: string, item: Connection) => {
    setError(undefined);
    try {
      await action(client, id, {
        serviceId: service.id,
        connectionId: item.id,
      });
      setDeleting(undefined);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
    }
  };
  return (
    <section>
      <div className="cr-row">
        <h2>{service.name}</h2>
        <button type="button" onClick={() => client.navigate?.("/overview")}>
          All services
        </button>
        <button type="button" onClick={() => setEditing("new")}>
          Connect code
        </button>
      </div>
      {error && (
        <p role="alert" className="cr-error">
          {error}
        </p>
      )}
      {editing !== undefined && (
        <RepositoryForm
          key={typeof editing === "string" ? editing : editing.id}
          serviceId={service.id}
          item={typeof editing === "string" ? undefined : editing}
          client={client}
          providers={providers}
          done={() => {
            setEditing(undefined);
            refresh();
          }}
        />
      )}
      {service.connections.length === 0 && (
        <p>No code connected to this service yet.</p>
      )}
      {service.connections.map((item) => (
        <article key={item.id} className="cr-card">
          <div className="cr-row">
            <h3>{item.name}</h3>
            <span className="cr-status">{item.status}</span>
          </div>
          <p>
            {item.provider} · {item.repository}
            {item.folder && ` / ${item.folder}`}
            {item.branch && ` · ${item.branch}`}
          </p>
          <p>Last fetched: {timestamp(item.lastFetchedAt)}</p>
          {item.version && (
            <p>
              Version: <code>{item.version.slice(0, 12)}</code>
            </p>
          )}
          {item.error && <p className="cr-error">{item.error}</p>}
          {item.instructions && (
            <p className="cr-instructions">{item.instructions}</p>
          )}
          <div className="cr-row">
            <button
              type="button"
              onClick={() => client.navigate?.(route(service.id, item.id))}
            >
              Explore files
            </button>
            <button type="button" onClick={() => setEditing(item)}>
              Settings
            </button>
            <button
              type="button"
              disabled={item.status === "queued" || item.status === "syncing"}
              onClick={() => void perform("refresh", item)}
            >
              Fetch now
            </button>
            <button type="button" onClick={() => setDeleting(item.id)}>
              Remove
            </button>
          </div>
          {deleting === item.id && (
            <div className="cr-row">
              <p>Remove this connection and its saved code?</p>
              <button
                type="button"
                onClick={() => void perform("remove", item)}
              >
                Remove connection
              </button>
              <button type="button" onClick={() => setDeleting(undefined)}>
                Cancel
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
