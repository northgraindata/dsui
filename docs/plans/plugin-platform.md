# Plugin platform: staged implementation plan

Status: implementation underway in [DSUI-20](https://linear.app/northgrain-data/issue/DSUI-20/build-oss-plugin-foundation-with-typed-host-capabilities-and-ui-slots). Agreed direction: plugin pages reuse DSUI's existing declarative component model; plugins may compose core components and define custom components with the same `defineComponent` contract as adapters. Plugin packages are built-in or loaded from an immutable, verified GitHub revision; the adapter loader remains a separate subsystem. Implemented so far: plugin SDK/runtime, trusted installed package loading, strict plugin config, dependency/lifecycle handling, sanitized service catalog, permission-checked plugin procedures, catalog-driven sidebar, serializable page-node rendering through `DeclarativePageRenderer`, and an example plugin. Custom browser component bundles/visible slot rendering, GitHub artifact loading, auth provider replacement, storage and jobs remain follow-up work. Keep backend API modernization and durable jobs in separate stacked PRs.

## Outcome and boundaries

DSUI OSS loads trusted optional features at startup; private Pro packages depend on OSS interfaces, never the reverse. A plugin adds platform behavior; an adapter still describes one external service and keeps its existing SDK, registry, host isolation, and `adapters:` configuration. Do not wrap or migrate adapters into plugins. A missing, disabled, or failing optional plugin cannot prevent ordinary OSS service navigation and adapter execution. No licensing, Pro code, agent framework, health scoring, repository scanner, or generic community-plugin sandbox is included in the foundation PR.

```text
browser app -> host-owned route/slot -> plugin contribution
             -> plugin API handler -> scoped host facade -> existing service logic
server startup -> validated plugin config -> manifest/dependency checks
               -> atomic contribution registration -> start -> readiness -> stop
```

### Contract sketch

```ts
type PluginId = string; // validated kebab-case; unique per installation

interface PluginDefinition<TConfig> {
  metadata: { id: PluginId; name: string; version: string; apiVersion: 1 };
  configSchema: z.ZodType<TConfig>;
  requires?: readonly PluginId[];
  setup(registry: PluginRegistry<TConfig>): void; // declarative contributions
  start?(context: PluginStartContext<TConfig>): Promise<void> | void;
  stop?(): Promise<void> | void;
}

interface PluginPageDefinition {
  id: string;
  title: string;
  description?: string;
  render(input: PluginPageRenderInput): PageNode | readonly PageNode[];
}

interface PluginPageRenderInput {
  params: Record<string, string>;
  client: { call(procedureId: string, input: unknown): Promise<unknown> };
}

interface PluginRegistry<TConfig> {
  page(page: PluginPageDefinition): void;
  navigation(input: { id: string; area: "primary" | "secondary";
    label: string; icon?: KnownIcon; pageId: string; order?: number }): void;
  slot<K extends PluginSlotName>(input: { id: string; slot: K;
    componentId: string; order?: number }): void;
  procedure(input: PluginProcedureDefinition): void; // named, schema-validated
  authentication?(provider: AuthenticationProvider): void; // singleton provider
  authorization?(provider: AuthorizationProvider): void; // singleton provider
  // Job registration is activated by the stacked jobs PR, not this PR.
}

interface PluginStartContext<TConfig> {
  readonly config: Readonly<TConfig>;
  readonly services: ServiceCatalog; // sanitized list/get; no connection secrets
  readonly logger: ScopedLogger;
  // Scoped storage, secrets, audit and jobs are added only with real implementations.
}
```

`PageNode` is imported from the adapter SDK shared component contract. A plugin page composes the same built-ins and can emit custom references with `defineComponent`; those references resolve from the plugin's verified browser bundle. The `PluginPageClient` is namespaced to the current plugin and only invokes its declared procedures, not adapter resources/actions.

`ComponentDefinition` is the adapter SDK component contract: compositions use existing core nodes such as `PageHeader`, `Card`, `Button` and `Grid`; a custom component uses `defineComponent` with a typed/validated props schema and a package-relative browser entry. Plugin page render functions produce the same serializable node tree consumed by `DeclarativePageRenderer`. Keep adapter-specific connection/resource bindings out of plugin pages: plugin reads/actions call the plugin's typed procedures through a plugin-specific browser client. The shared renderer is allowed to render both kinds of page, while host-owned execution context distinguishes adapter references from plugin procedures.

The contract is host-facing and transport-independent. Plugin backend calls `context.services.list()` rather than making HTTP requests to DSUI or importing `routes/services.ts`/`DsuiDatabase`. The current slice returns sanitized, paginated summaries and no connection secrets; it deliberately omits health probes. The backend PR must strengthen user-triggered calls with caller/permission scope and add a separately scoped system principal for future background callers. Do not reuse today's `publicService()` directly for lists: it probes each adapter's health and `refreshConfig()` reloads adapters per request. The current host implementation is a thin composition-root facade to be extracted behind the DSUI-22 application service.

Plugin procedures carry Zod input/output contracts and a permission identifier; the host owns validation, authorization, errors, auditing and URL namespace (`/api/v1/plugins/:pluginId/...`). Existing Hono endpoints remain usable in the foundation PR. [DSUI-22](https://linear.app/northgrain-data/issue/DSUI-22/standardize-backend-and-web-contracts-with-orpc-for-plugin-procedures) later supplies the oRPC transport and typed client, without changing the host facade. No raw `app: Hono`, SQL handle, or arbitrary middleware in a plugin context. Binary uploads, OAuth callbacks and streaming require explicit, separately reviewed route capabilities rather than a catch-all.

Configuration is owned by `dsui.yaml`, validated first by the host and then by the plugin schema. Package sources are either built-in/installed packages or GitHub repositories pinned to a full immutable commit and verified artifact integrity. Floating branches, runtime builds and package install hooks are not supported; final manifest fields need an ADR.

```yaml
plugins:
  code-repository:
    package: "@northgraindata/dsui-plugin-code-repository"
    enabled: true
    config:
      local:
        allowedRoots: [/workspace]
  health-intelligence:
    source: git
    repository: "git+https://github.com/acme/dsui-plugin-health"
    commit: "<full-40-character-commit-sha>"
    integrity: "sha512-<verified-artifact-digest>"
    entry: "./dist/plugin.mjs"
```

Built-ins are regular installed packages. GitHub sources must pin an immutable commit and integrity for the built server and browser artifacts. Reuse the adapter installer's verification requirements as a reference, but implement and own plugin discovery/install/lifecycle separately: plugins add server APIs and UI and therefore do not use `adapter-host`. In v1 only trusted first-party/private Pro or explicitly trusted operator-installed plugin code may execute in-process; a commit hash and digest establish immutability, not trust, and this is not a sandbox for arbitrary community code. Public GitHub source is the initial remote target; private GitHub authentication and marketplace UX require a separate decision. Existing adapter support already includes installed local packages plus verified pinned npm/Git bundles in an isolated adapter host; do not refactor or rename that system in DSUI-20.

No configured entry means no optional plugins; `enabled: false` removes all its contributions. Keep YAML-managed values distinct from UI-managed values; reject duplicate IDs rather than silently overriding. The current slice uses the existing config environment interpolation, but plugin-specific secret references/redaction need an explicit secrets capability before credentials are accepted. UI-managed encrypted secrets and external secret providers are separate work: no plaintext config or decrypted value reaches navigation metadata, page JSON or browser bundles. Startup validates ID/version/dependencies and rejects duplicate contribution IDs, missing page targets, cycles and conflicting singleton auth providers. Register atomically, record per-plugin readiness, dispose in reverse dependency order. Plugin-set/config changes require restart in v1; service/adapter refresh behavior remains unchanged.

### UI reference

Host-owned, typed slots; no XPath, DOM selectors, global CSS patches, or component monkey-patching. Namespaced contribution IDs, stable ordering (`order`, then plugin ID and contribution ID), and bounded layouts. An empty slot has no visual footprint. Context contains public service data only:

| Slot | Host placement | Context | Consumer |
| --- | --- | --- | --- |
| `dashboard.service-card.trailing` | `apps/web/src/components/home-dashboard.tsx` inside each `.stack-card`, outside the main link/menu hit areas | `{ service: ServiceSummary }` | health ring |
| `service.workspace.after-header` | `apps/web/src/components/adapter-workspace.tsx` after `.adapter-heading`, before adapter page content | `{ service: ServiceSummary }` | health progress bar |
| `settings.sections` | `apps/web/src/features/settings/settings-screen.tsx` | sanitized principal | plugin settings (add when needed) |

Navigation belongs in `apps/web/src/components/app-chrome.tsx` and a single host-owned route in `apps/web/src/router.tsx` (`/plugins/$pluginId/$`), with page resolution and a 404 for disabled or unknown plugins. Do not add a separate React router per plugin. The first page renderer supports plugin-authored serializable node trees built with shared adapter SDK components and a plugin-scoped procedure client; do not reuse adapter connection/resource bindings for plugin API calls. Next, extend the renderer's external-component resolver to use namespaced plugin IDs and the same `ComponentProps` contract as adapters. The server must serve only the verified browser bundle declared by the plugin manifest, with a unique plugin namespace and bounded bundle size. Do not reuse the adapter-ID URL convention or let plugin bundles ship a second React copy. Widget slot registration references `defineComponent` IDs; host-owned components mount them at the exact slot and pass only public typed context. Reserve deterministic space/fallback states for failed widgets and keep the host in charge of focus, keyboard behavior, responsive layout, and error boundaries. Batch plugin data per dashboard rather than one network request per card.

### Authorization boundary

One active authentication provider and one authorization provider, selected deterministically at startup. Existing `none`/`local` behavior remains the default until a dedicated auth migration; user-provided enterprise auth removal is separately owned. `authenticate` yields a principal or null; `authorize` receives principal, permission and resource, and is checked server-side for *every* plugin procedure and adapter action/resource request. Hiding navigation or a service in UI is not authorization. Explicit deny takes precedence; unknown permissions fail closed under an installed policy. Anonymous/none mode has a documented default principal. SSO/RBAC implementations live outside OSS.

## PR boundaries and dependency stack

| PR / issue | Base branch | Owns | Explicitly excludes |
| --- | --- | --- | --- |
| Plugin foundation — DSUI-20 | `main` | plugin SDK/runtime/config, trusted built-in and pinned GitHub artifacts, shared declarative pages/`defineComponent`, visible custom components/UI slots, sidebar, limited host facades, sample plugin and conformance tests | oRPC migration, route cleanup, background execution, feature plugins, enterprise auth deletion |
| Backend API — DSUI-22 | DSUI-20 branch (change base to `main` after parent merges) | application `ServiceCatalog`, oRPC contracts/transport/web client, structured errors and auth/audit middleware, REST-compatible migration | plugin loader/UI slots, jobs, removal of `packages/core` unless independently justified |
| Durable jobs — DSUI-82 | DSUI-22 branch (change base after parents merge) | job registration extension, SQLite migrations, worker/scheduler/leases, run API, lifecycle and tests | agent, health, lineage, repository scanning |

The backend API can be designed concurrently, but its stacked PR should be based on the plugin branch and touch the application-service/transport surface, not plugin UI. The jobs PR is based on backend so it can reuse typed procedures and plugin-scoped service access. Split enterprise-auth removal into another issue/PR with its own migration compatibility review; existing `0003_enterprise_auth` has shipped migration order and must not simply be deleted. [DSUI-27](https://linear.app/northgrain-data/issue/DSUI-27/remove-packagescore) remains a separate follow-up and is not implied by adopting oRPC. [DSUI-35](https://linear.app/northgrain-data/issue/DSUI-35/connect-service-to-code) is a future Pro plugin using these primitives, not part of foundation.

### Foundation change map

- `packages/plugin-sdk/` (new): manifest types, typed contributions, config schema, plugin API version, shared component/page contract imported from the adapter SDK, browser-safe contracts separated from server-only context.
- `packages/server/src/plugins/` (new): discovery/install of trusted built-in and pinned GitHub artifacts, dependency ordering, atomic registry, lifecycle/readiness, scoped facades and route dispatch. `packages/server/src/app.ts`: one composition point; register plugin routes in the API surface, dispose plugin runtime in `close()`.
- `packages/server/src/config.ts`: strict `plugins` field without silently accepting malformed plugin config; preserve existing `services` and `adapters` behavior. `packages/server/src/routes/`: catalog, page and namespaced procedure dispatch; reuse existing auth before any plugin endpoint.
- `apps/web/src/router.tsx`, `features/plugins/plugin-page-screen.tsx`, `components/app-chrome.tsx`: shared declarative page renderer, plugin procedure client and sidebar nav. `components/home-dashboard.tsx` and `components/adapter-workspace.tsx`: add actual host-owned slot renderers in a follow-up within DSUI-20; catalog slot metadata alone is not UI rendering. `apps/web/src/api.ts`: catalog/page/procedure calls; typed procedure client generation belongs to DSUI-22.
- `packages/renderer`: reuse its declarative renderer, `ComponentProps` and external-component failure states; add plugin namespace and verified bundle URL resolution without changing adapter wire format. Use adapter SDK `defineComponent`/component primitives rather than a parallel plugin component DSL. Add example plugin in `examples/` and document install/config/enable/disable/development.

### Backend and job change map

- Core service-domain endpoint rule (DSUI-22): introduce/retain an endpoint only when the same provider-neutral input/output contract has a meaningful use for **at least three distinct service/adapter types**; count applicability, not currently configured instances. Document three examples when adding a core operation. One- or two-provider workflows belong in adapter resources/actions or namespaced plugin procedures; core may expose their generic execution/auth mechanism. This rule does not apply to platform endpoints such as auth, server health, config or plugin discovery. Audit existing routes before moving them, and preserve compatibility until callers are migrated.
- DSUI-22: `packages/server/src/routes/{errors,services,execute,auth}.ts`, `packages/server/src/auth.ts`, `packages/core/src/index.ts` (compatibility), `apps/web/src/api.ts`; add typed contracts outside server to keep browser imports safe. Preserve current `/api/v1` clients until a documented cutover. Cover malformed JSON, typed error codes, permission denial, pagination, legacy response shape and adapter upstream failures.
- Jobs issue: `packages/server/src/db/migrations/` (append new numbered migrations, never rewrite history), `packages/server/src/plugins/` job contribution, dedicated worker/scheduler module, API run list/detail/start/cancel, runtime shutdown; job definitions only in plugin SDK. Adapter SDK watcher polling in `packages/adapter-sdk/src/runtime/resource-executor.ts` stops when unwatched and is **not** a durable scheduler.

## Acceptance and verification coverage

| Level | Required cases |
| --- | --- |
| SDK/unit | invalid/duplicate IDs, incompatible API version, dependency cycles/missing deps, duplicate page/procedure/slot, navigation target, deterministic ordering, config schema errors, sanitized manifest |
| Runtime/integration | zero-plugin startup; enabled/disabled sample; optional plugin failure isolated and visible in readiness; auth-provider conflict; restart applies changed config; server closes/disposes; adapter services/pages/actions unchanged; prohibited plugin route denied even when UI hides it |
| UI | nav visible only when enabled/authorized, disabled/unknown plugin 404, service-card and workspace slots for multiple adapters, no nested clickable controls, keyboard/focus, responsive 320/768/1440, empty/error/loading states and no secrets in network payload |
| API stack | audit core routes against the three-adapter applicability rule and document keep/move/migrate decisions; contract tests cover generic operations across at least three different adapters; browser/client compatibility, structured error status/code, caller-scoped service list, pagination, direct-URL authorization, no N+1 adapter probes |
| Jobs stack | one execution per lease under concurrent workers, restart recovery, duplicate enqueue/idempotency, timeout/retry/cancel, stale lease takeover, disabled plugin job not run, audit/permissions for manual trigger, migration from existing DB |

Focused checks: plugin SDK typecheck/tests; server `bun test` and typecheck; web typecheck/build; affected adapter SDK and adapter tests/typechecks if those contracts change. Before handoff run repository `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`; `bun run check` omits tests and build. Record exact failures/baselines; CI includes Docker and delivery checks. Public API, security, lifecycle and package-boundary decisions need ADRs under `docs/engineering/decisions/` plus migration guidance.

## After the stack

Build `Code Repository` (DSUI-35) as a separate Pro plugin: server-local paths first, then GitHub/GitLab token through environment-backed secret refs, later OAuth/GitHub App; keep service-to-repository many-to-many and restrict filesystem roots. Health Intelligence consumes jobs and the two slots; Unified Lineage consumes adapters and optional code index; AI Assistant and specialists consume permission-checked tools; Alerts and later Automation consume events/jobs. None of these product features needs to be implemented to validate the plugin foundation.
