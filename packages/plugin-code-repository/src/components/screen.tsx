import { Card, Grid, Value } from "@northgraindata/dsui-plugin-sdk";
import { route } from "../model";
import { Explorer } from "./explorer";
import { ConnectionStatus, Empty, SourceIcon } from "./presentation";
import { React } from "./react";
import { Settings } from "./settings";
import {
  overviewSchema,
  type Props,
  screenProps,
  timestamp,
  useResource,
} from "./shared";
import { styles } from "./styles";
export function RepositoryScreen({ node, client, renderNode }: Props) {
  const params = screenProps.parse(node.props).props;
  const [refresh, setRefresh] = React.useState(0);
  const overview = useResource(
    client,
    "overview",
    { serviceId: params.serviceId },
    !params.connectionId,
    refresh,
  );
  const data = overview.data ? overviewSchema.parse(overview.data) : undefined;
  const service = data?.services.find((item) => item.id === params.serviceId);
  return (
    <div className="cr-screen">
      <style>{styles}</style>
      {params.connectionId && params.serviceId ? (
        <Explorer
          key={`${params.connectionId}/${params.path}`}
          client={client}
          renderNode={renderNode}
          serviceId={params.serviceId}
          connectionId={params.connectionId}
          path={params.path ?? ""}
        />
      ) : params.serviceId ? (
        service && data ? (
          <Settings
            service={service}
            providers={data.providers}
            client={client}
            refresh={() => setRefresh((value) => value + 1)}
          />
        ) : (
          <p>{data ? "Service not found or access denied." : "Loading…"}</p>
        )
      ) : data ? (
        <>
          {renderNode(
            client,
            Grid({
              content: [
                Card({
                  variant: "metric",
                  icon: "layers",
                  title: "Services",
                  content: Value({
                    field: "count",
                    fallback: String(data.services.length),
                  }),
                }),
                Card({
                  variant: "metric",
                  icon: "code",
                  title: "Code connections",
                  content: Value({
                    field: "count",
                    fallback: String(
                      data.services.reduce(
                        (count, item) => count + item.connections.length,
                        0,
                      ),
                    ),
                  }),
                }),
                Card({
                  variant: "metric",
                  icon: "check",
                  title: "Up to date",
                  content: Value({
                    field: "count",
                    fallback: String(
                      data.services
                        .flatMap((item) => item.connections)
                        .filter((item) => item.status === "ready").length,
                    ),
                  }),
                }),
              ],
            }),
          )}
          <header className="cr-section-heading">
            <div>
              <h2>Connected services</h2>
              <p>
                Browse source code or select a service to manage its
                connections.
              </p>
            </div>
          </header>
          <div className="cr-services">
            {data.services.map((item) => (
              <article key={item.id} className="cr-service-card">
                <button
                  type="button"
                  className="cr-service-title"
                  onClick={() => client.navigate?.(route(item.id))}
                >
                  {item.iconUrl && (
                    <img src={item.iconUrl} alt="" width={24} height={24} />
                  )}
                  <span>
                    {item.name}
                    <small>{item.adapter}</small>
                  </span>
                  <span className="cr-link">
                    Manage <span aria-hidden="true">→</span>
                  </span>
                </button>
                <div className="cr-connections">
                  {item.connections.map((connection) => (
                    <button
                      type="button"
                      key={connection.id}
                      className="cr-connection"
                      onClick={() =>
                        client.navigate?.(route(item.id, connection.id))
                      }
                    >
                      <div className="cr-connection-heading">
                        <SourceIcon provider={connection.provider} />
                        <strong>{connection.name}</strong>
                        <span className="cr-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </div>
                      <span
                        className="cr-repository"
                        title={connection.repository}
                      >
                        {connection.repository}
                      </span>
                      <span className="cr-branch">
                        {connection.branch || "Local files"}
                        {connection.folder && ` / ${connection.folder}`}
                      </span>
                      <div className="cr-connection-footer">
                        <ConnectionStatus status={connection.status} />
                        <span title={timestamp(connection.lastFetchedAt)}>
                          {connection.lastFetchedAt
                            ? "Fetched " +
                              new Date(
                                connection.lastFetchedAt,
                              ).toLocaleDateString()
                            : "Awaiting first fetch"}
                        </span>
                      </div>
                    </button>
                  ))}
                  {!item.connections.length && (
                    <button
                      type="button"
                      className="cr-connection cr-connect-empty"
                      onClick={() => client.navigate?.(route(item.id))}
                    >
                      <span aria-hidden="true">＋</span>
                      <strong>Connect source code</strong>
                      <span>GitHub, GitLab or a local folder</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!data.services.length && (
              <Empty
                title="No services yet"
                description="Add a service to connect its source code."
              />
            )}
          </div>
        </>
      ) : (
        <p>Loading services…</p>
      )}
      {overview.error && (
        <p role="alert" className="cr-error">
          {overview.error}
        </p>
      )}
    </div>
  );
}
