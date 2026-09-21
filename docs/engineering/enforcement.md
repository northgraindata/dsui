# Current Enforcement

The repository currently enforces quality through package scripts and CI rather
than one universal adapter conformance harness.

For SDK or adapter changes, run:

```bash
bun run --filter @northgraindata/dsui-adapter-sdk typecheck
bun run --filter @northgraindata/dsui-adapter-duckdb typecheck
bun run check
bun run build
```

Run the affected package tests when the package defines a test script. Host or
protocol changes also require the server integration checks.

The long-term goal is a shared conformance harness covering adapter manifests,
connection validation, lifecycle disposal, serialized pages, resources, actions,
and persistent stores.
