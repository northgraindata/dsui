![DSUI Host monitoring plugin — Keep an eye on host resources.](./assets/banner.png)

[Plugin SDK](../plugin-sdk) · [Source](./src/plugin.ts) · [DSUI](../../README.md)

# Host monitoring plugin

Inspect CPU load, memory, process memory, uptime and disk space for the environment running DSUI.

Package: `@northgraindata/dsui-plugin-monitoring`. This is currently a private workspace package.

## Configure

Load the local source from a repository checkout:

```yaml
plugins:
  monitoring:
    source: local
    path: ./packages/plugin-monitoring
    enabled: true
    config:
      paths:
        - path: /data
          mount: DSUI data
      maxVolumes: 16
```

Run DSUI from the repository root for this relative path, or use an absolute path. The source builder prepares the plugin and any declared browser bundle. Restart DSUI after changing configuration.

## Behavior and limits

- Displays CPU load, system memory, busiest configured path and DSUI resident memory in metric cards.
- Metric cards, runtime details and volume capacity meters refresh together every five seconds while the page is open.
- Charts update continuously without pause controls.
- CPU and memory history share a row; disk history sits next to per-path capacity meters.
- Runtime details distinguish DSUI process uptime from the observed host OS uptime.
- Historical chart series are sampled by a background job, including while the page is closed.
- CPU load measures runnable/waiting work and is not a CPU utilization percentage.
- Storage history is a mean across readable configured paths; paths may share one filesystem.
- Paths default to the runtime temporary and home directories. `maxVolumes` defaults to 16 and is capped at 32.
- Measurements describe what the DSUI process can observe; container deployments may differ from the underlying host. This plugin does not collect metrics from remote services.

Plugins run as trusted code in the DSUI server process. See the [plugin definition](./src/plugin.ts) for configuration defaults and registered capabilities.

## Development

Run from the repository root after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-plugin-monitoring test
bun run --filter @northgraindata/dsui-plugin-monitoring typecheck
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).

## Continuous incident diagnostics

The background sampler runs every ten seconds, independently of open pages.
Resource history is stored as indexed rows in `resource-history.sqlite` in the
plugin's persistent storage directory. Charts aggregate inside SQLite to roughly
400 points; the sampler no longer clones and serializes seven days of arrays on
every tick. Old samples expire after seven days. Operation history is also capped
at 10,000 entries. Existing array-based history is not migrated.

Host resources includes an incident history combining recent resource samples
and adapter operations on one UTC timeline, including the resource sample before
each retained operation. Completed operations are logged once rather than copied
into every later sample. Samples include host CPU utilization,
DSUI process CPU/RSS/heap, event loop delay, swap where available, and isolated
adapter process CPU/RSS on Linux. Process CPU uses one core as 100% and can exceed
100%; host utilization is normalized across host CPUs. Container views reflect
what the OS exposes and may include the host beyond a container's allocation.

Shared-process adapters cannot be assigned honest per-adapter CPU or RAM: their
operations record service/adapter identity, category, elapsed time and outcome.
Remote data services' own CPU/RAM are not measured by this host plugin. No SQL,
connection settings, inputs, results, exception messages or credentials are
recorded. Global diagnostics require administrator access.

`diagnostic-*.log` contains JSON Lines in the same persistent plugin directory.
Files rotate daily or at 10 MB and expire after seven days, with a total 100 MB
budget that can shorten retention under heavy activity. The independent Cloud
agent supplies external measurements during a DSUI stall. Recent in-memory
operation tracking is bounded (500 completed, 1,000 active); overwritten entries
are counted. Abrupt termination can lose operations between ten-second samples.
The process boot identifier and uptime help distinguish restarts from gaps.
