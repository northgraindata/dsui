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
