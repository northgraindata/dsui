# Example plugin

This workspace package demonstrates the current trusted plugin SDK: typed config, a declarative page built from shared adapter SDK components, a navigation item/UI slot, namespaced procedures, and the sanitized `context.services.list()` host capability.

Configure an installed package in `dsui.yaml`:

```yaml
plugins:
  example-plugin:
    package: "@northgraindata/dsui-plugin-example"
    enabled: true
    config:
      greeting: "Welcome"
```

Trusted plugins currently load in the DSUI server process. Only install plugin packages whose code you trust. Declarative page nodes render through the shared renderer. Custom browser bundles and visible UI slot rendering are the next implementation increment.
