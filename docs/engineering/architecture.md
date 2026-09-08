# Architecture and ownership

This document defines the direction required of new changes and identifies
important gaps in the current implementation. It is not a claim that every
existing path already conforms. Read the [standards](standards.md) and record
consequential changes through [decision records](decisions/README.md).

## Product constraints

dsui is a lightweight, local-first interface for a data stack, with one server-side
adapter model and one compact developer UI. This repository is the Apache-2.0 OSS
edition. Planned Pro and Enterprise editions must not make the OSS edition depend
on a proprietary service or weaken its usefulness. Do not expand the application
into an orchestrator, catalog, observability suite, or universal vendor console.

## Package ownership

Dependencies point toward shared contracts. Import a package's supported entry
point; do not reach into another package's implementation files.

| Area | Owns | Must not own or import |
| --- | --- | --- |
| `packages/core` | Browser-safe domain and wire contracts | Node/Bun APIs, adapters, server implementation, UI frameworks |
| `packages/adapter-sdk` | Server-side authoring definitions and runtime semantics | Product UI, server application wiring, vendor clients |
| `packages/adapter-*` | Provider clients, schemas, resources, actions, page composition | Browser code or another adapter's internals |
| `packages/server` | Credentials, config, SQLite, auth, installation, execution, HTTP serialization | Vendor-specific dispatch or product UI |
| `packages/ui` | Reusable tokens and UI primitives | Server, SDK runtime, provider semantics |
| `apps/web` | Rendering shared contracts, interaction and local UI state | Server, SDK runtime, adapter packages, stored secrets |
| `apps/site`, `apps/docs` | Public static content | Runtime credentials or adapter execution |

For example, a reusable table result belongs in a core-owned contract. A provider
client maps vendor output into that contract on the server side; a generic web
renderer consumes it. A browser branch on an adapter ID or an undocumented
`schemas` operation is not a substitute for a capability contract.

## Execution and lifecycle

The current SDK distinguishes resources (data), stores (state), actions (behavior),
pages (composition), context (dependencies), and adapter definitions (identity and
composition). Refer to the [SDK mental model](../../packages/adapter-sdk/docs/concepts/mental-model.md)
for authoring semantics rather than introducing competing terminology here.

The server resolves adapters through one loader. Local packages execute in-process;
versioned external packages install with integrity verification and execute through
the subprocess host. Both implement `AdapterBackend`. HTTP routes authorize the
operation and resolve the connection before invoking that backend.

The subprocess host currently serves one request per process. Resource and action
calls create an SDK instance and dispose it before returning. An SDK instance may
support stores and page scopes when used directly, but that does not imply those
scopes persist across host requests. Changes to persistence or execution lifetime
must specify ownership, cleanup, isolation, and transport behavior together.

The intended end-to-end boundary is:

1. Adapter definitions and provider clients execute on the server side.
2. The host/server validates and translates results into browser-safe core contracts.
3. The browser renders validated declarative data with shared components.
4. User interactions address declared operations; the server authorizes and
   validates each request before execution.

Never serialize credentials, clients, closures, stores, or executable adapter
definitions to make rendering work. A new component or capability needs a supported
wire representation, validation, renderer, and tests across the affected layers.
Adapters do not supply browser JavaScript, React, HTML, CSS, SVG, or iframes.
Server-side composites may build supported declarative nodes, not inject markup.

## Trust boundaries

Browser requests, configuration, installed packages, subprocess output, and provider
responses are untrusted at their owning edges. Validate before use. Keep resolved
secrets inside the server execution boundary; allowlist public payload fields and
sanitize public errors. Apply resource and message limits before buffering arbitrary
amounts of external data.

An adapter necessarily receives the credentials and access needed by its client.
A subprocess provides execution separation; it is not an OS security sandbox and
does not establish that third-party code is trustworthy. Integrity verifies bytes,
not author intent. Do not describe community adapters as safe to run solely because
their package hash matches.

Authorization currently maps resources to `inspect` and actions to `execute`.
Preserve the distinction in adapters and both execution paths. Any new exception
requires a shared, testable authorization contract rather than an adapter-specific
route bypass.

## Current gaps to account for

- Core currently contains service and adapter metadata contracts, not a complete
  declarative page/result protocol. SDK component nodes remain SDK-owned.
- The host catalog exposes page paths, and host requests cover describe, health,
  resources, and actions. This is not end-to-end SDK page rendering.
- `apps/web/src/screens.tsx` includes operation-name and positional-row assumptions
  alongside presentation. Do not use those assumptions as the model for new views.
- The SDK root exports package-source, archive, and integrity helpers alongside
  authoring primitives. Separate their ownership through a compatibility decision,
  not an incidental export deletion.
- Cancellation and lifetime differ across execution paths. A shared method name
  alone is not proof of equivalent semantics.

These gaps require focused implementation work. The first protocol decision must
define serializable views and results, binding identity, page/store lifetime,
validation, authorization, cancellation, and compatibility. Exercise one complete
adapter-to-browser path before expanding the protocol. Track enforcement separately
in [enforcement.md](enforcement.md).
