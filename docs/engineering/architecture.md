# Architecture

DSUI is a server-side workspace for connecting multiple services through
adapters. The underlying services continue to run independently; DSUI provides a
single interface for their useful workflows.

## Runtime Flow

```text
Browser
  -> DSUI server
  -> adapter registry and host
  -> adapter instance and context
  -> resources, actions, stores, and pages
  -> external service
```

The server validates configuration and creates one isolated adapter instance per
configured service. The adapter context owns service clients and is disposed with
the instance. Adapter requests may run in an isolated host process, so adapter
code must not depend on process-local state surviving between requests.

## Adapter Boundaries

- **Connection** validates service configuration.
- **Context** constructs clients and owns lifecycle.
- **Resource** reads external data and declares refresh behavior.
- **Action** performs a command or mutation and invalidates changed resources.
- **Store** owns local or persistent adapter state.
- **Page** composes routes and shared UI components.

Credentials stay on the server. Browser output is a serialized page model and
browser components receive only explicitly serialized props and runtime client
capabilities.

See the [Adapter SDK documentation](/docs/adapter-sdk) for authoring details.
