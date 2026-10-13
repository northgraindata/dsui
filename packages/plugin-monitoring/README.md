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

- Displays host resource measurements and historical chart series sampled by a background job.
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
