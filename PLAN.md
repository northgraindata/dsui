# dsui v0.1 Implementation Plan

## Summary

Build dsui as a production-grade Bun/Turborepo monorepo with three applications:

- `apps/web`: React, Vite, TanStack Router developer interface.
- `apps/site`: Astro static landing page.
- `apps/docs`: Astro/Fumadocs documentation published beneath `/docs`.

Use Better-T-Stack as a temporary seed for compatible Bun, Turborepo, Vite, Hono, Biome, Lefthook, and Fumadocs configuration, then reshape it into dsui’s architecture. Deliver native binaries, a multi-architecture container, a working Compose demonstration, Coolify-ready site/docs artifacts, complete documentation, CI, and benchmark infrastructure.

## Repository and runtime architecture

- Create only these architectural packages:
  - `core`: service/config models, capability contracts, errors, health, authorization.
  - `server`: Hono API, SQLite, auth, configuration loading, encryption, adapter runtime.
  - `ui`: tokens and customized primitives owned by dsui.
  - `adapter-sdk`: experimental adapter authoring API.
  - `adapter-test`: shared conformance and hostile-package tests.
  - `cli`: `dsui`, `start`, `version`, `doctor`, and internal `adapter-host`.
  - `adapter-trino`, `adapter-kafka`, `adapter-s3`: independently testable built-ins.
- Use Bun workspaces, Turborepo, strict TypeScript, Biome, Lefthook, Zod, Vitest/Bun Test, and Playwright.
- Use `bun:sqlite` with Drizzle or equivalent focused SQLite integration for UI-managed services, encrypted credentials, users, sessions, invitations, audit events, and adapter installation metadata.
- Compile the backend, CLI, built-in adapters, migrations, and Vite output into a release executable with writable `/data` for local state.
- Public CLI remains deliberately small:
  - `dsui` and `dsui start`
  - `dsui version`
  - `dsui doctor`, including configuration, connectivity, encryption, database, and adapter preflight checks
  - no `add`, `connect`, or interactive configuration commands
- Expose versioned `/api/v1` endpoints for adapter manifests, service CRUD/testing, health, declarative views, capability operations, binary object preview/download, auth, workspace administration, invitations, SSO, and audit history.
- Support unary JSON, streaming NDJSON, and binary operation responses. Propagate request cancellation into adapters.
- Provide liveness and readiness endpoints. Readiness covers configuration, SQLite, and required adapter availability.

## Configuration, persistence, and authentication

- Load `/etc/dsui/dsui.yaml` or `DSUI_CONFIG`; interpolate only `${ENV_NAME}` expressions and fail clearly on missing variables.
- Never serialize resolved declarative secrets, include them in browser responses, or print them in logs and diagnostics.
- Treat YAML services as read-only and label them “Managed by configuration.” Duplicate service IDs across YAML and SQLite fail startup.
- Encrypt UI-managed credentials and enterprise provider secrets using AES-256-GCM with versioned keys derived from `DSUI_MASTER_KEY`. Support key rotation through a keyring.
- Authentication modes:
  - `none`: local/development mode.
  - `local`: email/password, invitations, secure sessions.
  - `enterprise`: local auth plus Better Auth SSO for OIDC and SAML.
- Model one workspace per self-hosted installation. Defer multi-tenant cloud organizations.
- Roles:
  - `viewer`: inspect services and data.
  - `operator`: execute queries and declared adapter actions.
  - `admin`/`owner`: manage connections, users, SSO, security, and adapter installations.
- Enforce CSRF/origin checks, secure proxy/TLS handling, session expiry, login throttling, SSRF protections, redacted structured logging, and immutable audit records.

## Adapter contract and customized UI

- Keep Trino, Kafka, S3, Polaris, and future service-specific behavior outside application core.
- Define an experimental, versioned `AdapterDefinition` containing metadata, SDK compatibility, Zod connection schema, secret paths, health, capabilities, operations, declarative views, cancellation, pagination, response mode, authorization class, and error mapping.
- Give adapters a narrow runtime context containing scoped logging, cancellation, operation input, and the relevant resolved connection. Do not provide database, session-secret, or master-key access.
- Keep React, navigation, theming, accessibility, keyboard behavior, tables, dialogs, loading, and errors inside dsui.
- Allow adapters to customize interfaces through validated descriptors for core renderers:
  - service information
  - query workbench
  - schema/tree browser
  - table browser
  - topic and message browsers
  - consumer groups
  - object browser
  - job browser
  - record list/detail
  - constrained action forms
- Descriptors may configure tabs, labels, columns, filters, detail fields, pagination, empty states, actions, safe formatters, and authorization. They may not provide HTML, CSS, SVG, React, browser JavaScript, arbitrary URLs, or iframes.
- Differentiated built-in experiences:
  - Trino: query workbench, catalogs, schemas, tables, columns, and previews.
  - Kafka: topics, partitions, bounded messages, offsets, and consumer groups.
  - S3/MinIO: buckets, prefixes, objects, metadata, previews, and streamed downloads.
  - Polaris is a documented community-adapter example using catalog, record, and job views.
- Do not declare the adapter API stable until Trino, Kafka, and S3 pass the same contract suite.

## Community adapter distribution

Support public npm packages and public GitHub repositories as automatically installed, administrator-approved server modules.

Production configuration uses logical adapter IDs and immutable source definitions:

```yaml
adapters:
  polaris-npm:
    source: npm
    package: "@github_name/github_adapter"
    version: "1.2.3"
    integrity: "sha512-..."

  polaris-git:
    source: git
    repository: "git+https://github.com/user/adapter-repo.git"
    commit: "40-character-commit-sha"
    integrity: "sha512-..."

services:
  - id: catalog
    adapter: polaris-npm
    name: Polaris
    connection:
      endpoint: ${POLARIS_ENDPOINT}
```

- Built-in IDs are `trino`, `kafka`, and `s3`.
- Npm sources require public npm-compatible packages, exact SemVer, and tarball SHA-512 SRI.
- Git sources support public HTTPS GitHub repositories at full commit hashes with committed `dsui.adapter.json` and one prebuilt `dist/adapter.mjs` bundle. dsui never invokes Git, installs dependencies, or builds source.
- Reject ranges, tags, aliases, mutable versions, lifecycle scripts, native addons, submodules, Git LFS, arbitrary tarball URLs, and unsupported hosts.
- Community packages contain a manifest, one bundled ESM entry, license, notices, SDK compatibility, and no browser/native code.
- Store validated bundles content-addressably under `/data/adapters/store`, with installation state in SQLite. Keep the active and two prior known-good versions within a bounded quota.
- Never auto-upgrade or silently fall back. Configuration changes activate another exact version or commit.
- Use cached exact artifacts offline. Download, integrity, compatibility, and validation failure keeps the UI available, marks affected services unavailable, and fails readiness.
- Add `dsui doctor --resolve-adapter <reference>` and `dsui doctor --check-adapters`; neither edits configuration.
- Run each external adapter in an internal `dsui adapter-host` subprocess using framed JSON-RPC over stdin/stdout. Apply timeouts, output limits, crash recovery, and redacted logs.
- Treat the subprocess as fault containment, not a complete OS sandbox. Run the container non-root with a read-only root filesystem, writable `/data`, and no Docker socket.
- Verify SRI directly. Record npm provenance when present; provenance is advisory in v0.1.
- Defer private registries, GitHub tokens, OCI adapters, native addons, and adapter-provided web applications.

## Adapter template and author guide

- Add `templates/adapter` and publish the equivalent `northgraindata/dsui-adapter-template` repository.
- Include package and adapter manifests, source operations, a one-file ESM build, conformance tests, example `dsui.yaml`, README, SECURITY, LICENSE, notices, changelog, and provenance-enabled publishing workflow.
- Provide SDK helpers such as `defineAdapter`, `defineConnection`, capability builders, `secretPath`, paginated results, declarative view schemas, and standardized errors.
- Document lifecycle, connection forms, secret handling, operations, declarative UI, pagination, streaming, cancellation, binaries, security, testing, local linking, npm/GitHub distribution, SRI retrieval, publishing provenance, compatibility, and troubleshooting.
- Use Official, Community, and Unverified labels in docs. Do not add a central runtime marketplace.
- Contract tests cover manifest validity, compatibility, secret redaction, schemas, health, timeouts, cancellation, cursors, response limits, UI descriptors, cleanup, and unsupported browser/native code.
- Installer tests cover integrity mismatch, oversized artifacts, traversal, symlinks, malicious manifests, redirects, unsupported imports, truncation, incompatible SDK versions, and crash loops.

## Product UI, site, and documentation

- Build a dark-first application using the graphite tokens in `DESIGN.md`, Inter for UI, JetBrains Mono for technical values, compact spacing, 4–8px radii, minimal shadows, and selective Lucide-style icons.
- Implement the authenticated shell, keyboard navigation, compact service dashboard, Add Service flow, test-before-save, configuration-managed labels, service views, command palette, dialogs, tables, loading states, empty states, and honest error states.
- Use individually stored official service logo SVGs; never install an entire icon library.
- Preserve the supplied reference at `assets/references/editorial-grid-reference.png` as a style reference only.
- Use ImageGen to create original graphite infrastructure hero and footer artwork. Retain source PNGs, prompts, and optimized WebP/AVIF derivatives.
- Build the Astro landing page with the required hero, real product UI, lightweight section without fabricated metrics, before/after comparison, adapters, real Compose code, CTA, attribution, and illustrated footer.
- Build searchable Fumadocs content under `/docs` covering Getting Started, Docker, Docker Compose, Configuration, Adapters, Trino, Kafka, S3/MinIO, Adapter SDK, Architecture, Contributing, CLI, Security, and community customization/install guides.
- Produce a single static site/docs artifact for Coolify with docs mounted beneath `/docs`.
- Add README, DESIGN, ARCHITECTURE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG, CODEOWNERS, Apache-2.0 license, screenshots, and minimal badges.

## Docker, demo, CI, and releases

- Provide a multi-stage non-root application image with compiled dsui, CA certificates, read-only root compatibility, and writable `/data`.
- Publish `linux/amd64` and `linux/arm64` GHCR images.
- Release native binaries for Linux and macOS on amd64 and arm64, with checksums, SBOMs, provenance/attestations, changelog, and signed releases.
- Provide a Compose demo containing dsui, Trino, Kafka, and MinIO. `docker compose up` must finish with configured healthy services, a Kafka topic, and a sample MinIO object.
- Pull-request CI gates:
  - format/lint
  - typecheck
  - unit/integration tests
  - adapter contracts and hostile installer tests
  - production builds
  - Playwright E2E
  - Docker build
  - Compose smoke validation
  - dependency and license audit
  - bundle-size checks
- Use Bun and Turborepo caching and parallel independent jobs.
- Continuously measure frontend bundle size, image size, idle memory, and cold startup. Publish raw measurements and establish regression budgets only from measured baselines.
- Use protected release workflows and keep Coolify credentials outside pull-request workflows.

## Execution sequence and ownership

Use small Terra subagents in non-overlapping tracks, with the primary agent reviewing contracts and integrating each wave:

1. Foundation: workspace tooling, package boundaries, SQLite, config, API skeleton.
2. Core UI: tokens, primitives, shell, dashboard, connection workflows.
3. Adapter platform: SDK, renderers, conformance, installer, host, template.
4. Official adapters: Trino, Kafka, S3.
5. Product completion: auth/SSO, binary streaming, Compose demo, CLI, security hardening.
6. Public experience: reference inspection, ImageGen artwork, landing page, docs, README, screenshots.
7. Delivery: Docker, CI, release automation, benchmarks, dependency/performance review.

No agents edit the same files concurrently. Contract and schema changes land before dependent adapter/UI work.

## Acceptance tests and defaults

- Fresh Compose checkout becomes usable with one command and shows healthy Trino, Kafka, and MinIO.
- YAML and UI-managed connections work together without exposing secrets.
- All three official adapters provide real service-backed workflows, not mocked dashboard data.
- A valid npm or exact-commit GitHub community adapter auto-installs, validates, starts in its host process, and renders differentiated core-owned UI.
- Tampered, mutable, incompatible, oversized, native, or browser-code adapters are rejected safely.
- Cached adapters work offline; missing artifacts never silently fall back.
- `none`, `local`, and `enterprise` auth modes, invitations, roles, OIDC, SAML, encryption, CSRF, and audit behavior have integration/E2E coverage.
- Object downloads stream without buffering whole files or revealing credentials.
- Application remains dense and utilitarian; public site carries the editorial visual language.
- Adapter API remains experimental until Trino, Kafka, and S3 validate it.
- Private package sources, cloud multi-tenancy, RBAC customization, marketplaces, Kubernetes, AI, lineage, orchestration, billing, and arbitrary plugin UI remain outside v0.1.
