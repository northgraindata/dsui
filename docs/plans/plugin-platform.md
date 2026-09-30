# Plugin platform: staged implementation plan

Status: proposed. The contracts below are targets for implementation and ADR review, not existing APIs. Owner: [DSUI-20](https://linear.app/northgrain-data/issue/DSUI-20/build-oss-plugin-foundation-with-typed-host-capabilities-and-ui-slots). Keep implementation, API modernization, and durable jobs in separate stacked PRs.

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

interface PluginRegistry<TConfig> {
  page(input: { id: string; render: PluginPageRenderer }): void;
  navigation(input: { id: string; area: "primary" | "secondary";
    label: string; icon?: KnownIcon; pageId: string; order?: number }): void;
  slot<K extends PluginSlotName>(input: { id: string; slot: K;
    order?: number; render: SlotRenderer<K> }): void;
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

The contract is host-facing and transport-independent. Plugin backend calls `context.services.list()` rather than making HTTP requests to DSUI or importing `routes/services.ts`/`DsuiDatabase`. `ServiceCatalog.list/get` returns sanitized, paginated service summaries and has an explicit caller/permission context for user-triggered requests; background callers later need a separate scoped system principal. Do not reuse today's `publicService()` directly for lists: it probes each adapter's health and `refreshConfig()` reloads adapters per request. Extract a bounded application service in the backend PR if needed.

Plugin procedures carry Zod input/output contracts and a permission identifier; the host owns validation, authorization, errors, auditing and URL namespace (`/api/v1/plugins/:pluginId/...`). Existing Hono endpoints remain usable in the foundation PR. [DSUI-22](https://linear.app/northgrain-data/issue/DSUI-22/standardize-backend-and-web-contracts-with-orpc-for-plugin-procedures) later supplies the oRPC transport and typed client, without changing the host facade. No raw `app: Hono`, SQL handle, or arbitrary middleware in a plugin context. Binary uploads, OAuth callbacks and streaming require explicit, separately reviewed route capabilities rather than a catch-all.

Configuration is owned by `dsui.yaml`, validated first by the host and then by the plugin schema. Example shape (subject to ADR):

```yaml
plugins:
  code-repository:
    enabled: true
    config:
      local:
        allowedRoots: [/workspace]
      github:
        token: { fromEnv: GITHUB_TOKEN }
```

No configured entry means installed built-ins follow documented defaults; `enabled: false` removes all its contributions. Keep YAML-managed values distinct from UI-managed values; reject duplicate IDs rather than silently overriding. `fromEnv` is resolved just-in-time server-side and redacted in diagnostics. UI-managed encrypted secrets and external secret providers are separate work: no plaintext config or decrypted value reaches navigation metadata, page JSON, logs, or browser bundles. Startup validates ID/version/dependencies and rejects duplicate contribution IDs, missing page targets, cycles and conflicting singleton auth providers. Register atomically, record per-plugin readiness, dispose in reverse dependency order. Explicitly specify what happens on config refresh: v1 requires restart for plugin-set/config changes; existing service/adapter refresh behavior is unchanged.

### UI reference

Host-owned, typed slots; no XPath, DOM selectors, global CSS patches, or component monkey-patching. Namespaced contribution IDs, stable ordering (`order`, then plugin ID and contribution ID), and bounded layouts. An empty slot has no visual footprint. Context contains public service data only:

| Slot | Host placement | Context | Consumer |
| --- | --- | --- | --- |
| `dashboard.service-card.trailing` | `apps/web/src/components/home-dashboard.tsx` inside each `.stack-card`, outside the main link/menu hit areas | `{ service: ServiceSummary }` | health ring |
| `service.workspace.after-header` | `apps/web/src/components/adapter-workspace.tsx` after `.adapter-heading`, before adapter page content | `{ service: ServiceSummary }` | health progress bar |
| `settings.sections` | `apps/web/src/features/settings/settings-screen.tsx` | sanitized principal | plugin settings (add when needed) |

Navigation belongs in `apps/web/src/components/app-chrome.tsx` and a single host-owned route in `apps/web/src/router.tsx` (`/plugins/$pluginId/$`), with page resolution and a 404 for disabled or unknown plugins. Do not add a separate React router per plugin. Pages can use the existing serialized `PageDocument` and `DeclarativePageRenderer`; trusted, explicitly registered frontend components may be introduced by a reviewed bundle contract. `packages/renderer/src/registry/external-components.ts` currently handles adapter bundles only; do not reuse its adapter-ID URL convention for plugin bundles or let a third-party bundle import a second React copy. The foundation PR proves a small example plugin adds a page, sidebar link, and both service slots; the health visuals themselves come later. Reserve deterministic space/fallback states for failed widgets and keep the host in charge of focus, keyboard behavior, responsive layout, and error boundaries. Batch plugin data per dashboard rather than one network request per card.

### Authorization boundary

One active authentication provider and one authorization provider, selected deterministically at startup. Existing `none`/`local` behavior remains the default until a dedicated auth migration; user-provided enterprise auth removal is separately owned. `authenticate` yields a principal or null; `authorize` receives principal, permission and resource, and is checked server-side for *every* plugin procedure and adapter action/resource request. Hiding navigation or a service in UI is not authorization. Explicit deny takes precedence; unknown permissions fail closed under an installed policy. Anonymous/none mode has a documented default principal. SSO/RBAC implementations live outside OSS.

## PR boundaries and dependency stack

| PR / issue | Base branch | Owns | Explicitly excludes |
| --- | --- | --- | --- |
| Plugin foundation — DSUI-20 | `main` | ADR, plugin SDK/runtime/loader/config, limited host facades, optional plugin routes/pages/nav and two UI slots, sample plugin and conformance tests | oRPC migration, route cleanup, background execution, feature plugins, enterprise auth deletion |
| Backend API — DSUI-22 | DSUI-20 branch (change base to `main` after parent merges) | application `ServiceCatalog`, oRPC contracts/transport/web client, structured errors and auth/audit middleware, REST-compatible migration | plugin loader/UI slots, jobs, removal of `packages/core` unless independently justified |
| Durable jobs — DSUI-82 | DSUI-22 branch (change base after parents merge) | job registration extension, SQLite migrations, worker/scheduler/leases, run API, lifecycle and tests | agent, health, lineage, repository scanning |

The backend API can be designed concurrently, but its stacked PR should be based on the plugin branch and touch the application-service/transport surface, not plugin UI. The jobs PR is based on backend so it can reuse typed procedures and plugin-scoped service access. Split enterprise-auth removal into another issue/PR with its own migration compatibility review; existing `0003_enterprise_auth` has shipped migration order and must not simply be deleted. [DSUI-27](https://linear.app/northgrain-data/issue/DSUI-27/remove-packagescore) remains a separate follow-up and is not implied by adopting oRPC. [DSUI-35](https://linear.app/northgrain-data/issue/DSUI-35/connect-service-to-code) is a future Pro plugin using these primitives, not part of foundation.

### Foundation change map

- `packages/plugin-sdk/` (new): manifest types, typed contributions, config schema, plugin API version, browser-safe contracts separated from server-only context.
- `packages/server/src/plugins/` (new): discovery of explicit trusted packages, dependency ordering, atomic registry, lifecycle/readiness, scoped facades and route dispatch. `packages/server/src/app.ts`: one composition point; register plugin routes before the static catch-all in `routes/system.ts`, dispose plugin runtime in `close()`.
- `packages/server/src/config.ts`: strict `plugins` field without silently accepting malformed plugin config; preserve existing `services` and `adapters` behavior. `packages/server/src/routes/`: catalog, page and namespaced procedure dispatch; reuse existing auth before any plugin endpoint.
- `apps/web/src/router.tsx`, `components/app-chrome.tsx`: generic page route/nav. `components/home-dashboard.tsx` and `components/adapter-workspace.tsx`: two host-owned service slots. `apps/web/src/api.ts`: minimal manifest/procedure fetching (typed client conversion belongs to DSUI-22).
- `packages/renderer`: only if declarative page rendering needs a host-owned bridge; do not change adapter SDK page wire format. Add example plugin in `examples/` and document install/config/enable/disable/development.

### Backend and job change map

- DSUI-22: `packages/server/src/routes/{errors,services,execute,auth}.ts`, `packages/server/src/auth.ts`, `packages/core/src/index.ts` (compatibility), `apps/web/src/api.ts`; add typed contracts outside server to keep browser imports safe. Preserve current `/api/v1` clients until a documented cutover. Cover malformed JSON, typed error codes, permission denial, pagination, legacy response shape and adapter upstream failures.
- Jobs issue: `packages/server/src/db/migrations/` (append new numbered migrations, never rewrite history), `packages/server/src/plugins/` job contribution, dedicated worker/scheduler module, API run list/detail/start/cancel, runtime shutdown; job definitions only in plugin SDK. Adapter SDK watcher polling in `packages/adapter-sdk/src/runtime/resource-executor.ts` stops when unwatched and is **not** a durable scheduler.

## Acceptance and verification coverage

| Level | Required cases |
| --- | --- |
| SDK/unit | invalid/duplicate IDs, incompatible API version, dependency cycles/missing deps, duplicate page/procedure/slot, navigation target, deterministic ordering, config schema errors, sanitized manifest |
| Runtime/integration | zero-plugin startup; enabled/disabled sample; optional plugin failure isolated and visible in readiness; auth-provider conflict; restart applies changed config; server closes/disposes; adapter services/pages/actions unchanged; prohibited plugin route denied even when UI hides it |
| UI | nav visible only when enabled/authorized, disabled/unknown plugin 404, service-card and workspace slots for multiple adapters, no nested clickable controls, keyboard/focus, responsive 320/768/1440, empty/error/loading states and no secrets in network payload |
| API stack | browser/client contract compatibility, structured error status/code, caller-scoped service list, pagination, authorization on direct URL, no N+1 adapter probes, transport migration does not break existing adapters |
| Jobs stack | one execution per lease under concurrent workers, restart recovery, duplicate enqueue/idempotency, timeout/retry/cancel, stale lease takeover, disabled plugin job not run, audit/permissions for manual trigger, migration from existing DB |

Focused checks: plugin SDK typecheck/tests; server `bun test` and typecheck; web typecheck/build; affected adapter SDK and adapter tests/typechecks if those contracts change. Before handoff run repository `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`; `bun run check` omits tests and build. Record exact failures/baselines; CI includes Docker and delivery checks. Public API, security, lifecycle and package-boundary decisions need ADRs under `docs/engineering/decisions/` plus migration guidance.

## After the stack

Build `Code Repository` (DSUI-35) as a separate Pro plugin: server-local paths first, then GitHub/GitLab token through environment-backed secret refs, later OAuth/GitHub App; keep service-to-repository many-to-many and restrict filesystem roots. Health Intelligence consumes jobs and the two slots; Unified Lineage consumes adapters and optional code index; AI Assistant and specialists consume permission-checked tools; Alerts and later Automation consume events/jobs. None of these product features needs to be implemented to validate the plugin foundation.
