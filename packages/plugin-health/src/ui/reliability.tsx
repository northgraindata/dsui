import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { reportSchema } from "../contract";
import { React } from "../react";
import { delta, duration, pagePath, percent } from "./format";
import { useResource } from "./hooks";
import { Empty, Notice, PageLink, Section, Tile } from "./parts";

type Days = 7 | 30;

/** This period against the one before it, with the services that need a look. */
export function Reliability({ client }: Pick<ComponentProps, "client">) {
  const { useState } = React;
  const [days, setDays] = useState<Days>(7);
  const report = useResource(client, "report", { days }, reportSchema);
  const data = report.data;
  const current = data?.current;
  const previous = data?.previous;

  return (
    <Section
      title="Reliability"
      detail={`The last ${days} days compared with the ${days} before.`}
      actions={
        <fieldset className="h-tabs" aria-label="Report period">
          {([7, 30] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {value} days
            </button>
          ))}
        </fieldset>
      }
    >
      {report.error && <Notice tone="error">{report.error}</Notice>}
      {!data && !report.error && <Notice>Loading report…</Notice>}
      {data && current && previous && (
        <>
          <div className="h-tiles">
            <Tile
              label="Uptime"
              value={percent(current.availability)}
              detail={
                current.availability === null || previous.availability === null
                  ? "no earlier data"
                  : `${delta(current.availability, previous.availability)} · was ${percent(previous.availability)}`
              }
            />
            <Tile
              label="Incidents opened"
              value={current.incidentsOpened}
              detail={`was ${previous.incidentsOpened}`}
              status={current.incidentsOpened > 0 ? "warning" : undefined}
            />
            <Tile
              label="Mean time to resolve"
              value={
                current.meanTimeToResolveMs === null
                  ? "—"
                  : duration(current.meanTimeToResolveMs)
              }
              detail={
                previous.meanTimeToResolveMs === null
                  ? "no earlier incidents"
                  : `was ${duration(previous.meanTimeToResolveMs)}`
              }
            />
            <Tile
              label="Longest incident"
              value={
                current.longestIncidentMs === null
                  ? "—"
                  : duration(current.longestIncidentMs)
              }
              detail={`${current.incidentsResolved} resolved`}
            />
          </div>
          {data.services.some((service) => service.availability !== null) ? (
            <div className="h-table-wrap">
              <table className="h-table">
                <thead>
                  <tr>
                    <th scope="col">Lowest uptime</th>
                    <th scope="col" className="h-right">
                      Uptime
                    </th>
                    <th scope="col" className="h-right">
                      Before
                    </th>
                    <th scope="col" className="h-right">
                      Incidents
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.services
                    .filter((service) => service.availability !== null)
                    .slice(0, 5)
                    .map((service) => (
                      <tr key={service.id}>
                        <td>
                          <PageLink
                            client={client}
                            to={pagePath.service(service.id)}
                          >
                            <strong>{service.name}</strong>
                          </PageLink>
                          <span className="h-since">{service.adapter}</span>
                        </td>
                        <td className="h-num h-right">
                          {percent(service.availability)}
                        </td>
                        <td className="h-num h-right h-muted">
                          {percent(service.previousAvailability)}
                        </td>
                        <td className="h-num h-right">{service.incidents}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Not enough history yet to compare periods.</Empty>
          )}
        </>
      )}
    </Section>
  );
}
