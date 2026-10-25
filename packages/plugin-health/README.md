![DSUI Service health plugin - See how your services are doing.](./assets/banner.png)

[Plugin SDK](../plugin-sdk) · [Source](./src/plugin.ts) · [DSUI](../../README.md)

# Service health plugin

Track the health of every service in your DSUI workspace over time.
The plugin schedules adapter health checks, keeps their history, calculates uptime and response times, and opens incidents when a service stays unhealthy.

Package: `@northgraindata/dsui-plugin-health`.
This is currently a private workspace package.

## What you get

- **Overview** with the current state of every service, 7-day uptime, response time and an hourly history strip.
- **Service pages** with uptime for 24 hours, 7, 30 and 90 days, response time percentiles, the checks each adapter reports, recent changes and incidents.
- **Objectives** with an availability target per service and the error budget that is left.
- **Incidents** that open when a service stays unhealthy and resolve when it recovers, with a timeline, acknowledgement and notes.
- **Maintenance windows and silences** so planned work does not count as downtime or raise incidents.
- **Around this time**, on each incident and service page: signals from other parts of DSUI that fired shortly before or after, such as a failed dbt run or a repository update.
- **Reliability** on the overview: the last 7 or 30 days against the period before, with uptime, incidents and mean time to resolve.
- **Signals** that other plugins and the host can react to when a service changes state, plus a weekly summary.
- **Dashboard and workspace summaries** through the service card and workspace slots.

## Configure

Load the plugin from a repository checkout:

```yaml
plugins:
  health:
    source: local
    path: ./packages/plugin-health
    enabled: true
    config:
      defaultIntervalMs: 300000
      timeoutMs: 30000
      services:
        warehouse:
          intervalMs: 900000
          sloTarget: 99.9
          sloWindowDays: 30
```

Run DSUI from the repository root for this relative path, or use an absolute path.
Restart DSUI after changing configuration.
Every option is optional.

| Option | Default | Meaning |
| --- | --- | --- |
| `defaultIntervalMs` | `300000` | Time between checks of one service, from 10 seconds to 24 hours. `checkIntervalMs` is accepted as the old name. |
| `timeoutMs` | `30000` | Longest a single check may take, up to 60 seconds. |
| `failureThreshold` | `2` | Consecutive non-healthy results before a service leaves healthy. |
| `recoveryThreshold` | `2` | Consecutive healthy results before a service returns to healthy. |
| `maxConcurrentProbes` | `8` | Checks in flight at once. |
| `maxConcurrentProbesPerAdapter` | `2` | Checks in flight at once against one adapter. |
| `maxServices` | `500` | Most services monitored. |
| `rawRetentionDays` | `7` | How long individual check results are kept. |
| `rollupRetentionDays` | `400` | How long daily summaries are kept. |
| `reopenWindowMinutes` | `10` | A service that fails again within this time reopens its last incident instead of opening a new one. |
| `services.<id>` | none | Per-service `intervalMs`, `sloTarget` and `sloWindowDays`. |

## How it works

Each adapter decides what healthy means for its own system and reports a status, an optional score and a list of checks.
The plugin treats those checks as opaque data.
It never branches on an adapter or on a check id, so a new adapter works without any change here.

A background scheduler is the only code that runs checks.
Opening a page, a dashboard or several browser tabs never contacts your services.
Checks run within a global and a per-adapter concurrency budget, so a slow or costly system cannot starve the others.
Each service has its own interval, spread with a small stable jitter so a large fleet does not check everything at the same second.

A service changes state only after several consecutive results agree.
One failed check does not raise an incident, and one success does not close one.
An unknown result carries no information and counts toward neither direction.
The first result for a service is accepted as it is.

### Uptime and response time

- Uptime is the share of measured checks in which the service was not unavailable.
- A degraded service is still serving, so it counts as available and is shown separately as "fully healthy".
- Unknown results are not measurements, and neither are checks taken during maintenance.
  A stopped DSUI or a planned outage does not read as downtime.
- Response time is the duration of the adapter health check.
  It never changes the reported status: a successful check that takes four seconds is still healthy.
- Figures are weighted by check count, not by elapsed time.
- Percentiles are estimated from a fixed latency histogram and are accurate to within one histogram bucket.

### Incidents

An incident opens when a service is accepted as degraded or unavailable, and resolves automatically when it recovers.
Moving between degraded and unavailable updates the same incident and records the change in its timeline.
Resolving an incident by hand while the service is still failing holds off a new one until the service has been healthy again.

### Maintenance and silences

- **Maintenance** suppresses incidents and signals and is excluded from uptime.
- **Silence** suppresses incidents and signals, but the time still counts as downtime because the outage happened.

Both can cover one service or, for administrators, every service.

### Around this time

The plugin reads the host's signal stream and keeps a compact log of signals that belong to a service.
It does not know any signal in particular, so every signal DSUI gains helps explain incidents without a change here.
Repeats of the same signal within five minutes fold into one entry, so a signal fired on every query does not bury the others.
Its own signals are left out, and the log is kept for 30 days.

The log starts when the plugin first runs and does not replay earlier history.
A host that cannot read the signal stream simply shows no such section.

A signal payload with a `summary`, `message`, `error`, `title` or `reason` text field has that text shown next to it.

### Links from checks

An adapter may attach a `href` to a check: a path inside the service workspace, such as `/dags`.
A failing check with one shows an "Open in service" link.
The plugin only links; it never runs anything.
Anything that is not a plain local path is dropped.

## Signals

The plugin emits a signal when a service's accepted state changes and an incident opens, changes or resolves.
Signals are published as `health.<id>`.

| Signal | Type | When |
| --- | --- | --- |
| `service-unavailable` | error | A service became unavailable. |
| `service-degraded` | warning | A service became degraded, or improved from unavailable to degraded. |
| `service-recovered` | success | A service recovered and its incident resolved. |
| `weekly-report` | info | Monday 08:00 server time, with the last 7 days compared with the 7 before. |

The payload contains `serviceId`, `serviceName`, `previous` and `current` health, `since`, `incidentId`, a `summary`, the `failingChecks` with their details, and `latencyMs` when known.
Signals are not emitted during maintenance or a silence.

The weekly report has no service.
Its payload contains `from`, `to`, `availability`, `previousAvailability`, the incidents opened and resolved, `meanTimeToResolveMs`, the services with the lowest uptime, and a one line `summary`.
The plugin only publishes it.
Anything subscribed to signals can deliver it, and without a subscriber it is just recorded.

## Resources

Other plugins can read the plugin's resources through the plugin catalog.
Responses carry a `version` field.
It increases only for a change that breaks a reader.

| Resource | Input | Returns |
| --- | --- | --- |
| `service-health` | none | Current state, uptime and history strip for every visible service. |
| `service-detail` | `serviceId` | One service with uptime ranges, objective, checks, changes and incidents. |
| `incidents` | `status`, `serviceId` | Incidents with counts and mean time to resolve. |
| `incident-detail` | `incidentId` | One incident with its timeline. |
| `suppressions` | none | Active and upcoming maintenance windows and silences. |
| `report` | `days` (7 or 30) | A period compared with the one before, with the services ordered by uptime. |

Every resource is limited to services the requesting account can see.

## Storage

The plugin keeps its data in its own `health` SQLite database, created and migrated through the host.
History recorded by earlier versions is imported once on first start, and the old database is left in place.

## Limits

- A check reports one result per service per run, so a service checked every 15 minutes has at most 96 results a day.
- Raw results are pruned after `rawRetentionDays`.
  Uptime for longer ranges comes from hourly summaries for up to 35 days and daily summaries beyond that.
- `check-now` is limited to one check per service every 10 seconds.
- Plugins run as trusted code in the DSUI server process.

## Development

Run from the repository root after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-plugin-health test
bun run --filter @northgraindata/dsui-plugin-health typecheck
bun run --filter @northgraindata/dsui-plugin-health build
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
