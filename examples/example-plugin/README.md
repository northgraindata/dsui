# Example plugin

This workspace package demonstrates the current trusted plugin SDK: typed config, a declarative page built from shared adapter SDK components, a navigation item/UI slot, namespaced procedures, and the sanitized `context.services.list()` host capability.

Configure an installed package in `dsui.yaml`:

```yaml
plugins:
  example-plugin:
    package: "@northgraindata/dsui-plugin-example"
    browserBundle: "@northgraindata/dsui-plugin-example/browser"
    enabled: true
    config:
      greeting: "Welcome"
```

Trusted plugins run in the DSUI server process. Only install code you trust. Declarative page nodes and slot widgets use the shared adapter SDK renderer; this example supplies a prebuilt `createComponents(React)` browser entry, with the host supplying React.

To use a prebuilt public GitHub artifact instead, pin the full commit and SHA-512 SRI digest of `plugin.json`:

```yaml
plugins:
  example-plugin:
    source: git
    repository: "git+https://github.com/acme/dsui-plugin-example"
    commit: "<40-character-commit-sha>"
    integrity: "sha512-<base64-digest-of-plugin.json>"
    config:
      greeting: "Welcome"
```

`plugin.json` must include `id`, `version`, `apiVersion: 1` and `server` / optional `browser` objects containing `entry`, `sha256`, and `bytes`. Entries are prebuilt single-file `./dist/*.mjs` artifacts; remote bundles cannot import other modules. The browser bundle exports `createComponents(React)` returning components keyed by namespaced `defineComponent` IDs. Plugin code is trusted in-process code; hashes only pin bytes. Authentication/authorization plugins additionally require `metadata.security: true` and `critical: true` in YAML. Configuration changes take effect on restart.

For plugin packages outside this monorepo, the published `@northgraindata/dsui/plugin-sdk` export provides `definePlugin`, the shared declarative UI primitives and types used by this example. Bundle your server plugin into one self-contained `.mjs` file before publishing the GitHub artifacts.
