# Example plugin

This workspace package demonstrates the current trusted plugin SDK: typed config, startup contributions for a page/navigation item/UI slot, a namespaced procedure, and the sanitized `context.services.list()` host capability.

Configure an installed package in `dsui.yaml`:

```yaml
plugins:
  example-plugin:
    package: "@northgraindata/dsui-plugin-example"
    enabled: true
    config:
      greeting: "Welcome"
```

Trusted plugins currently load in the DSUI server process. Only install plugin packages whose code you trust. Dynamic browser page rendering and custom React bundles are not part of this first runtime slice yet; page and slot contributions are registered in the plugin catalog for the host UI work.
