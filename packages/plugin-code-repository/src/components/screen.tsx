import { route } from "../model";
import { Explorer } from "./explorer";
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
        <div className="cr-services">
          {data.services.map((item) => (
            <article key={item.id} className="cr-card">
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
                <span>Settings →</span>
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
                    <strong>{connection.name}</strong>
                    <span>
                      {connection.provider} ·{" "}
                      {connection.branch || connection.repository}
                    </span>
                    <span>
                      {connection.status} ·{" "}
                      {timestamp(connection.lastFetchedAt)}
                    </span>
                  </button>
                ))}
                {!item.connections.length && (
                  <button
                    type="button"
                    className="cr-connection"
                    onClick={() => client.navigate?.(route(item.id))}
                  >
                    Connect code +
                  </button>
                )}
              </div>
            </article>
          ))}
          {!data.services.length && <p>Add a service to connect its code.</p>}
        </div>
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
