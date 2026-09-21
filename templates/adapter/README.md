# Adapter Template

Start a new adapter from the complete working example:

examples/example-adapter/
```

It includes package metadata, connection methods, context, resources, actions,
pages, components, tests, local loading, and release artifacts.

Before publishing an adapter:

1. Define and validate the connection configuration.
2. Keep credentials and service clients on the server.
3. Use resources for reads and actions for commands.
4. Use stores for adapter state and persistence.
5. Dispose long-lived clients through `disposeContext`.
6. Add tests for validation, lifecycle, resources, actions, and serialization.
7. Document available capabilities and known limitations.

Read the [Adapter SDK guide](/docs/adapter-sdk) for the full authoring model.
