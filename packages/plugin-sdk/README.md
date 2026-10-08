# Plugin SDK

A trusted plugin registers pages, UI slots, actions/procedures, resources, jobs,
and optional signals through `definePlugin`. The host validates inputs, handles
request authorization, owns the job queue and supplies private storage. Plugins
run in the server process and must be trusted.

## Pages

`definePage({ path, render })` supports static segments, `:named` parameters and
one final `*named` wildcard. For example, `/services/:serviceId/items/*path`
captures both `serviceId` and a nested `path`; the wildcard can be empty.
The catalog includes declared paths. The browser and host share
`resolvePluginPage` so legacy page IDs and static paths precede dynamic routes.
A page render receives decoded route parameters. Use percent encoding for path
segments and an optional URL fragment for client-side anchors.

## Service access and background work

A request that operates on a service must call
`await context.access.require(serviceId, "inspect" | "execute" | "manage")`
in addition to declaring its procedure permission. `context.services.get(id)`
checks service visibility and returns `null` for a missing or inaccessible
service. The service catalog includes an optional `iconUrl` for presentation.

`context.services.signals(id)` returns the visible service adapter’s declared
signals as qualified IDs and severity types, without opening a connection.
A missing or inaccessible service returns `null`. This optional capability
requires a host that supports the signal catalog; plugins should check for it
when they depend on enumerating signals before the first event occurs.

`await context.jobs.enqueue(jobId, input)` enqueues a job owned by the calling
plugin and returns its `runId`. The input is checked against the job definition.
Identical queued/running inputs are coalesced atomically; a completed run does
not prevent another refresh with the same input. Scheduled work uses `defineJob`
with an interval or cron. Background jobs are trusted plugin operations and run
outside request identity; they can access the host service catalog even when an
authorization provider is installed. Job handlers must respect the provided
abort signal and recheck mutable state before publishing results.

## Signals and errors

Declare a signal using `registry.signal({ id: "updated", payload: schema,
type: "success" })`, then publish it with
`await context.events.emit("updated", payload, serviceId)`. The SDK validates the
payload and declaration; the host namespaces its ID as `<pluginId>.updated`,
persists it through the existing signal bus and dispatches subscribed jobs.
The default signal type is `info`.

Throw `PluginRequestError(message, status)` for an intentional message safe for a
caller to see. Supported statuses are 400, 403, 404, 409 and 422. Unknown exceptions
remain redacted by the host. A job throwing `PluginRequestError` fails without
retry; other failures follow its configured retry policy.

## Storage and compatibility

`context.storage.openDatabase(name)` returns a cached SQLite handle in the
plugin's own data directory. `context.storage.directory?.()` returns that private
directory when supported by the host. The plugin owns its schema and migrations.

The new host capabilities are additive. An older plugin can continue using its
existing pages and storage. A plugin using a capability absent from its host
receives an explicit unavailable-capability error.

## Persisted event reading and installation administration

`context.events.read({ cursor, limit })` reads persisted signals in their stable
append order, returning `{ items, cursor, hasMore }`. Use `cursor: "latest"` to
start at the current tail; an omitted cursor replays the available history.
Page sizes are 1–500. Store the returned cursor atomically with processing results
in plugin storage and deduplicate effects by event ID. Empty pages can still
advance the cursor because the host filters events by service visibility. Signals
without a service are visible only to installation administrators or background
jobs. A cursor is specific to one DSUI database; it is not a timestamp.

`await context.access.requireAdmin()` requires an owner/admin request identity
and plugin manage permission. Use it for installation-wide settings or secrets
that service-level manage permission cannot authorize. Both additions are optional
host capabilities for compatibility; plugins using them must require a host that
implements them. Background jobs run as trusted installation operations.

## Adapter and plugin invocation

Trusted integrations can use the optional host capabilities below. Check availability
before calling them; older hosts can omit them.

- `services.describe(serviceId)` returns declared resource/action IDs and JSON input schemas.
- `services.query(serviceId, resourceId, input)` executes a validated adapter resource.
- `services.execute(serviceId, actionId, input, { signal, origin })` executes a validated
  adapter action, publishes its declared signals and audits it. The host checks execute
  permission for requests; background jobs are trusted plugin work. The SDK stamps the
  originating plugin ID; supply `origin.runId` to correlate emissions with a job.
- `plugins.available(pluginId)` checks an active integration.
- `plugins.query(pluginId, resourceId, input)` and `plugins.call(pluginId, procedureId, input)`
  invoke another plugin's registered contracts. Inputs are validated, caller permissions
  are checked and the target handler retains its service access checks.

Signal events can include `origin: { pluginId, runId? }`. Consumers can use this metadata
to avoid recursively reacting to their own actions. These capabilities belong to the
generic host; provider-specific clients and credentials stay inside their plugins.

## Sidebar profile slot

`sidebar.profile` replaces the sidebar's workspace profile when a plugin returns
content. With no contribution, an empty result or a request error, the host keeps
its default workspace/settings link. Request it with an empty `serviceIds` array;
the result has `serviceId: ""` because this slot belongs to the workspace.

Its render input includes the authenticated `principal` and an undefined
`service`. The host supplies the principal, never the request payload, and still
checks plugin inspect permission. Service slots keep receiving their service and
now also receive the authenticated principal. Keep personal account presentation
and data lookup in the contributing plugin.
