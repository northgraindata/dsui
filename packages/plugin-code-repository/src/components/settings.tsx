import type { z } from "zod";
import { type Connection, route } from "../model";
import { RepositoryForm } from "./form";
import { ConnectionStatus, Empty, SourceIcon } from "./presentation";
import { React } from "./react";
import { action, type Client, type overviewSchema, timestamp } from "./shared";
export function Settings({
  service,
  client,
  providers,
  refresh,
  refreshMinutes,
}: {
  service: z.infer<typeof overviewSchema>["services"][number];
  client: Client;
  providers: z.infer<typeof overviewSchema>["providers"];
  refresh: () => void;
  refreshMinutes: number;
}) {
  const [editing, setEditing] = React.useState<Connection | "new">();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState<string>();
  const [deleting, setDeleting] = React.useState<string>();
  const perform = async (id: string, item: Connection) => {
    setError(undefined);
    setPending(item.id);
    try {
      await action(client, id, {
        serviceId: service.id,
        connectionId: item.id,
      });
      setDeleting(undefined);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
    } finally {
      setPending(undefined);
    }
  };
  return (
    <section>
      <button
        className="cr-back"
        type="button"
        onClick={() => client.navigate?.("/overview")}
      >
        ← All services
      </button>
      <header className="cr-section-heading cr-settings-heading">
        <div className="cr-service-identity">
          {service.iconUrl && (
            <img src={service.iconUrl} alt="" width={32} height={32} />
          )}
          <div>
            <h2>{service.name}</h2>
            <p>
              {service.adapter} · {service.connections.length} code connection
              {service.connections.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {editing === undefined && (
          <button
            className="cr-primary"
            type="button"
            onClick={() => setEditing("new")}
          >
            ＋ Connect code
          </button>
        )}
      </header>
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
      {editing === undefined && service.connections.length === 0 && (
        <Empty
          title="Connect this service to its code"
          description="Choose a repository or local folder to browse the source behind this service."
        />
      )}
      {editing === undefined &&
        service.connections.map((item) => (
          <article key={item.id} className="cr-card">
            <header className="cr-card-heading">
              <SourceIcon provider={item.provider} />
              <div>
                <h3>{item.name}</h3>
                <p className="cr-repository">{item.repository}</p>
              </div>
              <ConnectionStatus status={item.status} />
            </header>
            <dl className="cr-details">
              <div>
                <dt>Source</dt>
                <dd>
                  {item.provider === "local"
                    ? "Local folder"
                    : item.provider === "github"
                      ? "GitHub"
                      : "GitLab"}
                </dd>
              </div>
              <div>
                <dt>Branch</dt>
                <dd>{item.branch || "Current files"}</dd>
              </div>
              <div>
                <dt>Folder</dt>
                <dd>{item.folder || "Repository root"}</dd>
              </div>
              <div>
                <dt>Last fetched</dt>
                <dd>{timestamp(item.lastFetchedAt)}</dd>
              </div>
              <div>
                <dt>Auto refresh</dt>
                <dd>
                  {refreshMinutes ? `Every ${refreshMinutes} min` : "Manual"}
                </dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>
                  <code>{item.version?.slice(0, 12) ?? "—"}</code>
                </dd>
              </div>
            </dl>
            {item.error && <p className="cr-error">{item.error}</p>}
            {item.instructions && (
              <details className="cr-instructions">
                <summary>Code instructions</summary>
                <p>{item.instructions}</p>
              </details>
            )}
            <div className="cr-card-actions">
              <button
                className="cr-primary"
                type="button"
                onClick={() => client.navigate?.(route(service.id, item.id))}
              >
                Explore files
              </button>
              {item.configKey ? (
                <span className="cr-field-help">
                  Managed in plugin configuration
                </span>
              ) : (
                <button type="button" onClick={() => setEditing(item)}>
                  Settings
                </button>
              )}
              <button
                type="button"
                disabled={
                  pending === item.id ||
                  item.status === "queued" ||
                  item.status === "syncing"
                }
                onClick={() => void perform("refresh", item)}
              >
                Fetch now
              </button>
              {!item.configKey && (
                <button
                  className="cr-danger cr-remove"
                  type="button"
                  disabled={pending === item.id}
                  onClick={() => setDeleting(item.id)}
                >
                  Remove
                </button>
              )}
            </div>
            {deleting === item.id && (
              <div className="cr-confirm">
                <p>Remove this connection and its saved code?</p>
                <button
                  className="cr-danger"
                  type="button"
                  disabled={pending === item.id}
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
