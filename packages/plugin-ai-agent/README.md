# DSUI Agent

User-initiated chat for investigating a DSUI workspace. The launcher, drawer,
conversations, instructions and tools belong to this plugin. The host contributes
only a generic `app.shell.actions` slot and permission-checked Plugin SDK capabilities.
No jobs, subscriptions, signal monitoring or autonomous background investigations
are registered.

## Development

From the repository root, using the pinned Bun version:

```sh
bun install --frozen-lockfile
bun run dev
```

Development automatically builds the browser bundle before starting the server.
Restart development after editing this plugin to rebuild it. AI SDK's
`ToolLoopAgent` runs directly inside the plugin on Bun; there is no separate
process, loopback bridge, runtime build, or Node 24 requirement.

The npm release and Docker image bundle the agent and its AI SDK dependencies.
Add this to your `dsui.yaml` (also present in `examples/data-stack/dsui.yaml`):

```yaml
plugins:
  ai-agent:
    package: "@northgraindata/dsui-plugin-ai-agent"
    browserBundle: "@northgraindata/dsui-plugin-ai-agent/browser"
    enabled: true
    config:
      model:
        provider: openai
        id: gpt-4.1-mini
        apiKey: "${DSUI_AGENT_API_KEY}"
```

`provider` supports `openai`, `anthropic`, or `gateway`; use a model ID available
to your provider (Gateway IDs include the provider prefix). OpenAI and Anthropic
use their direct provider APIs; Gateway is used only when explicitly selected.
You can put your key directly in YAML, but environment interpolation avoids
committing it. Restart DSUI after changing configuration. The browser receives
only whether a key is configured, never the key itself. Treat YAML and plugin
storage as secrets. Without a key, the drawer still opens for setup.

Optional configuration: `maxToolCalls` defaults to `20`; `timeoutSeconds` defaults
to `120`. The tool-call count is enforced separately from the model-step limit.
After the budget is spent, the next generation is text-only.

## Service mentions

The drawer is chat-only, without Chat, Tools or Insights tabs. Type `@` in the
composer to search accessible configured services by name, ID or adapter.
Select with the mouse, Arrow keys and Enter/Tab; Escape dismisses suggestions.
Mentions are highlighted while typing and in conversation messages.

Friendly handles use service names, e.g. `Airflow Prod` becomes `@airflow-prod`.
Duplicate names fall back to service IDs; `@<service-id>` is always accepted.
The backend resolves mentions independently against the caller's visible services.
Unknown or inaccessible mentions are rejected. Mentions scope tool access for
that message only; without mentions, the selected conversation context applies.
Mentioned service IDs are retained for later conversation permission checks.

## Tools and boundaries

| Tool | Plugin SDK capability |
| --- | --- |
| `list_services` | Visible service summaries and pagination |
| `get_service_health` | Explicit adapter health probe |
| `list_events` | Previously recorded events, not live monitoring |
| `discover_resources` | Declared adapter resource IDs and input schemas |
| `read_resource` | One declared adapter resource, validated by the adapter |

No action, arbitrary SQL, shell, filesystem, web-search or model-generated code
execution tools are enabled. Adapter resources are read APIs: adapter authors
remain responsible for their queries having no destructive side effects. Tool
results can contain real business data and are sent to the configured model;
only select services whose data you are authorized to share with that provider.
Outputs are bounded and truncation is explicit. Known structured secret fields
and occurrences of the configured model key are redacted from tool evidence.
This does not guarantee arbitrary logs or business data contain no sensitive data.

Conversations are owned by the authenticated principal and persisted in
plugin-scoped SQLite. Every selected or previously accessed service is checked
before returning or continuing a conversation. The model receives previous
messages and paired tool calls/results reconstructed from saved evidence.
Old conversations remain readable; external session IDs/cursors are no longer used.
Tools run in the original DSUI request's permission context, and connection
credentials are resolved by the host, not exposed to the plugin.

The plugin consumes the AI SDK text stream and saves a projection that the UI
polls. Closing the drawer does not stop a turn; use Stop to cancel it.
Cancellation discards late tool results; an adapter's already-started read may
still finish because the resource SDK does not expose forced cancellation.
Restarting DSUI interrupts active responses; saved conversations can be reopened.
Active turns and locks are local to one DSUI process. Horizontal scaling still
requires shared conversation storage and distributed ownership/locking; AI SDK
does not provide those automatically.

The implementation follows AI SDK's
[agent guide](https://ai-sdk.dev/docs/agents/building-agents).

## Manual verification

```sh
bun run --filter @northgraindata/dsui-plugin-ai-agent typecheck
bun run --filter @northgraindata/dsui-plugin-ai-agent build
```

Automated agent tests are deferred for now. Check the live integration by sending
two messages with a valid provider key, testing Stop, and reopening the drawer.
Typechecking and bundling alone do not verify a live provider response.
