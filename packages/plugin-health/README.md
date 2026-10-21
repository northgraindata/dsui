![DSUI Service health plugin — See how your services are doing.](./assets/banner.png)

[Plugin SDK](../plugin-sdk) · [Source](./src/plugin.ts) · [DSUI](../../README.md)

# Service health plugin

Aggregate adapter-reported health into a workspace overview and service-card contributions.

Package: `@northgraindata/dsui-plugin-health`. This is currently a private workspace package.

## Configure

Load the local source from a repository checkout:

```yaml
plugins:
  health:
    source: local
    path: ./packages/plugin-health
    enabled: true
    config:
      checkIntervalMs: 3600000
      timeoutMs: 30000
      maxServices: 100
```

Run DSUI from the repository root for this relative path, or use an absolute path. The source builder prepares the plugin and any declared browser bundle. Restart DSUI after changing configuration.

## Behavior and limits

- Shows healthy, warning, unavailable and unknown service states, with available probe details and latency.
- Response time alone never changes the adapter-reported status; a successful 4000 ms dbt check stays healthy.
- Health probes are executed through the host and adapter capabilities; response time is an adapter health check, not ICMP ping.
- A singleton background job records status and response time even when no browser is open.
- `checkIntervalMs` defaults to 3,600,000 ms (one hour) and accepts 10,000 to 3,600,000 ms; restart DSUI after changing it.
- History is kept for seven days in the plugin-owned `health-history` SQLite database.
- Each service has a last-week strip with one bar per hour, the worst status in that hour and average measured latency in its tooltip.
- Grey gaps mean no measurement, including time when DSUI was stopped; the healthy-check percentage excludes unknown results and is not an uptime SLA.
- History reads are limited to services visible to the requesting account.
- The current status still refreshes on demand; Refresh does not add extra history samples.
- `timeoutMs` defaults to 30,000 and is capped at 60,000; `maxServices` defaults to 100 and is capped at 500. This is a bounded batch, not an unlimited inventory.

Plugins run as trusted code in the DSUI server process. See the [plugin definition](./src/plugin.ts) for configuration defaults and registered capabilities.

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
