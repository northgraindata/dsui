# 0002 — Optional platform plugins

Status: proposed for DSUI-20 review. Related: [plugin implementation plan](../../plans/plugin-platform.md).

## Context

Adapters model an external service through resources, actions, stores and pages. Cross-service capabilities (health, lineage, auth, automation) need optional server/API/UI integration without teaching individual adapters about Pro features. The shipped adapter loader can import local packages and install pinned community adapters, but its `adapter-host` process only implements the adapter protocol. It cannot safely become a generic server/UI plugin process by renaming it.

## Decision

- Keep adapters, their loader, and `adapter-host` separate. Add `@northgraindata/dsui-plugin-sdk` and a server plugin runtime. Plugins are registered once at startup; plugin configuration changes need restart.
- Ship built-in plugins in DSUI itself. They load from the bundled artifact directory with no `dsui.yaml` entry, have no `enabled` flag, and cannot be turned off or replaced: a configuration entry using a built-in id is rejected instead of shadowing it. A built-in only loads when the operator's image or npm package provides its bundle, so installs that do not ship it are not reported as broken.
- Optional plugins come from `dsui.yaml`, which is read at boot and never written at runtime. Any public GitHub repository is accepted; the operator chooses the repository and is responsible for what it installs. `enabled: false` disables a configured plugin and it contributes nothing.
- Load already-installed packages in-process, or prebuilt GitHub server/browser artifacts at an immutable commit with a SHA-512 manifest pin and checked artifact hashes/lengths. Fetch from `raw.githubusercontent.com` only, reject redirects and oversized downloads, never run package scripts or build untrusted source on the server. Cache verified artifacts for offline startup. The operator explicitly chooses trusted code; integrity and commit pins are not a sandbox. No arbitrary community plugin marketplace in v1.
- Plugin backend gets a scoped, sanitized host facade (`services.list/get`, typed procedures, logger), not Hono, SQLite or connection credentials. Procedures and plugin UI endpoints reuse DSUI authentication and are checked on direct requests. An authentication or authorization provider is singleton and critical: `metadata.security: true` plus `critical: true` in config, fail startup if it fails. Policies can narrow the existing role permissions; they cannot silently grant an existing role more. Caller-scoped service visibility applies to plugin procedures and existing service routes. Adding login/callback endpoints for a future SSO plugin needs a separate explicit contract.
- Reuse adapter SDK `PageNode`, `serializeNodes`, `defineComponent` and shared UI primitives for plugin pages and slot widgets. Render through the existing renderer. Host-owned slot names and public service context determine placement. Browser bundles are namespaced by plugin and provided as a prebuilt `createComponents(React)` factory so React comes from the host. Plugin JS has the same trust boundary as any browser code shipped by the operator, not a sandbox.
- Namespaced plugin procedures run through Hono temporarily. DSUI-22 owns the oRPC transport and central API error contract; DSUI-82 owns durable background jobs. Neither changes the plugin/page/slot contract here.

## Alternatives

- Turn adapters into plugins: rejected; a one-service adapter protocol and a cross-cutting platform feature have different lifecycles and capabilities.
- XPath/DOM insertion or React monkey-patching: rejected; unstable layout contracts, no type-safe context or accessible ownership.
- Auto-install floating GitHub branches or execute npm install hooks: rejected; non-reproducible startup and uncontrolled code execution.
- Run server plugins inside `adapter-host`: rejected; that host has no safe API/job/auth/UI extension protocol, and falsely implying isolation would hide the trust boundary.

## Compatibility and follow-up

Existing adapter configuration, public service URLs, role defaults and serialized adapter page format remain. Plugin contributions use API version 1 and must be rejected when incompatible. Optional feature packages are absent from the OSS build unless installed. The plugin manifest, its authentication policy seam, trusted UI bundle mechanism and shutdown lifecycle need host/SDK/web consumer tests. Enterprise auth dead-code removal and existing database migration compatibility are independently owned. DSUI-22 must replace the temporary in-composition-root service facade with a fully caller-scoped application service and preserve legacy HTTP consumers during oRPC migration.
