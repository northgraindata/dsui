# Architecture

## System shape

```text
Browser
  │ HTTP / streaming responses
  ▼
dsui server (Bun + Hono)
  ├─ static React application
  ├─ configuration, auth, SQLite, encryption, audit
  ├─ built-in Trino / Kafka / S3 adapters
  └─ adapter-host subprocess ── community adapter
                                  │
                                  ▼
                         external data service
```

The server is the credential boundary. The browser receives sanitized adapter manifests, declarative view descriptions, and operation results. It never receives stored connection secrets or resolved environment variables.

## Monorepo boundaries

- `apps/web` is the compact React application.
- `apps/site` is the static Astro landing page.
- `apps/docs` is static Astro/Fumadocs documentation.
- `packages/core` contains browser-safe contracts.
- `packages/server` owns persistence, HTTP, auth, configuration, and adapter execution.
- `packages/ui` owns design tokens and browser primitives.
- `packages/adapter-sdk` is the experimental server adapter API.
- `packages/adapter-test` is the conformance suite.
- Each built-in adapter is an independent package.
- `packages/cli` owns the public commands and internal adapter host mode.

Dependencies point inward toward contracts. Core never imports an adapter, server implementation, or UI framework.

## Service configuration

`dsui.yaml` is loaded before the HTTP listener becomes ready. Only `${NAME}` interpolation is supported. A missing variable or duplicate service identifier is a configuration error. Declarative service objects retain their unresolved representation for diagnostics, and secrets are redacted before structured data can reach logs.

UI-managed services live in SQLite. Their connection objects are encrypted with AES-256-GCM using versioned keys derived from `DSUI_MASTER_KEY`. Declarative and UI-managed services share the same runtime service registry but have different mutation policies.

## Adapter model

An adapter definition includes metadata, a Zod connection schema, secret paths, health, capability declarations, and operation implementations. Capabilities select a renderer owned by core UI and may declare columns, filters, actions, authorization, pagination, cancellation, and response modes.

Built-in adapters execute in process. External adapters use immutable prebuilt ESM bundles and a versioned handshake with the internal `adapter-host` subprocess. The child receives only the relevant connection and operation request. This is fault containment, not a complete sandbox; administrators must trust community adapter code.

Npm adapters require exact versions and tarball SRI. GitHub adapters require public HTTPS repositories, full commit hashes, committed bundles, and bundle SRI. No package scripts, source builds, Git invocation, native addons, floating references, or adapter browser code are permitted.

## HTTP and authorization

The public application API is under `/api/v1`. Every operation maps to an authorization class before entering an adapter. Responses are JSON, bounded NDJSON streams, or streamed binary bodies. Request abort signals propagate to adapter clients.

One workspace exists per installation. `viewer`, `operator`, and `admin` roles separate inspection, execution, and administrative changes. Authentication mode can be `none`, `local`, or `enterprise`; enterprise mode adds OIDC and SAML provider configuration.

## Health and failure

Liveness reports whether the process can serve requests. Readiness covers configuration, SQLite, and configured adapter availability. A broken community adapter does not take down the explanatory UI: affected services become unavailable and readiness fails. Configuration syntax and decryption failures fail startup instead of silently changing behavior.

## Distribution

The release embeds the built product application, server, migrations, CLI, and built-in adapters into a Bun executable. Native archives target Linux and macOS on amd64 and arm64. A non-root multi-architecture container adds only the executable, CA certificates, and writable `/data` contract.
