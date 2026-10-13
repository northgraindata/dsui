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
      timeoutMs: 5000
      maxServices: 100
```

Run DSUI from the repository root for this relative path, or use an absolute path. The source builder prepares the plugin and any declared browser bundle. Restart DSUI after changing configuration.

## Behavior and limits

- Shows healthy, warning, unavailable and unknown service states, with available probe details and latency.
- Health probes are executed through the host and adapter capabilities.
- `timeoutMs` defaults to 5000 and is capped at 60,000; `maxServices` defaults to 100 and is capped at 500. This is a bounded batch, not an unlimited inventory.

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
