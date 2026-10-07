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

## Table links

The agent receives navigation links alongside resource reads and is instructed to make table names clickable in its
Markdown answers. Only the table name is linked, directly in its existing cell;
there is no separate link column or "Open table" action.
Clicking a link opens that service's table page in the same
tab, including the exact database and schema when the adapter provides them.

Adapters own their routes and return optional `navigation` entries containing
`label`, an adapter-relative `path`, and identifying fields such as database,
schema and name. After permission checks, the plugin prefixes paths with the
service URL and rejects paths that escape it. It never maps adapter names to
routes. Adapters should URL-encode each variable path segment; parentheses are
escaped for Markdown compatibility. PostgreSQL/DuckDB exploration resources
provide these entries. Resources without navigation fall back to service links,
not guessed deep links.
Existing saved answers are unchanged; ask again to receive linked results.

## Attachments

Use the paperclip in the composer to attach photos, PDFs, or UTF-8 text/code
files. Paste screenshots and clipboard files directly into the composer with
Cmd/Ctrl+V; ordinary text pasting still works. File pasting depends on the
browser exposing files through the clipboard. Review image previews and remove
attachments before sending. A message can contain only attachments.

Supported photos: PNG, JPEG, WebP, and GIF. Text includes CSV, JSON, Markdown,
SQL, logs, YAML, and common source files. Office documents, archives, audio,
and video are currently unsupported. Limits: five files and 10 MB total per
message, 5 MB per photo/PDF, 256 KB per text file, and 50 MB per conversation.

Attachment contents are sent to the configured model. Text files are included
as text, while photos and PDFs use AI SDK file parts and require a model that
supports those inputs. Attachments persist in plugin-owned SQLite alongside
the conversation, with ownership and service permission checks on retrieval.
Polling sends attachment metadata only; image previews and downloads fetch file
contents separately. Reopening a conversation restores its attachments.

## Tools and boundaries

| Tool | Plugin SDK capability |
| --- | --- |
| `list_services` | Visible service summaries and pagination |
| `get_service_health` | Explicit adapter health probe |
| `list_events` | Previously recorded events, not live monitoring |
| `discover_resources` | Declared resource IDs, descriptions, schemas, policies and availability |
| `read_resource` | One declared adapter resource, validated by the adapter |
| `list_actions` | Declared action IDs, descriptions and schemas; discovery only |

The plugin has no adapter-specific tools, resource-ID mappings, SQL dialects or
table routes. The workflow is `list_services` → `discover_resources` and/or
`list_actions` for relevant services → `read_resource` with discovered arguments.
Resource and action discovery use `cursor`, `limit` (default 20, maximum 50),
and `nextCursor`. New adapters require no agent-plugin changes to expose their
declared resources/actions. Existing adapters without descriptions still work
through their resource IDs and input schemas.

The former five data tools are now adapter-owned resources, not model tools:

| Resource | Available implementations |
| --- | --- |
| `search-catalog` | PostgreSQL, DuckDB |
| `inspect-table` | PostgreSQL, DuckDB |
| `find-tables` | PostgreSQL, DuckDB |
| `preview-table` | PostgreSQL, DuckDB |
| `query-readonly` | PostgreSQL, opt-in |

These implementations are not a universal requirement on adapters. The agent
selects operations using the descriptions and schemas returned by each service.
Actions can be described but not executed by the agent. There is no action-run
SDK capability or `perform_action` model tool here; execution needs a separate
permission/confirmation workflow before it can be enabled.

The provided catalog resources operate on one service/database per call, with an optional schema.
For workspace-wide searches the agent lists services/databases and repeats the
search in each relevant context. Results are sorted by schema/name and paginated
with `offset`, `limit` (maximum 50), and `nextOffset`. Column bounds are inclusive:
"more than 10 columns" uses `minColumns: 11`. Catalog filtering runs inside the
adapter in one metadata query, not one agent tool call per table. Counts may
include views; `kind` identifies the relation type. Row counts are estimates,
and views may not have an estimate. Table names remain the only clickable link.

Previews use Markdown tables by default, with column headers and one row per
record. JSON is used only when explicitly requested; other explicit format
requests are honored too. Previews default to 10 rows, with a maximum of 50.
Set `allowTablePreview: false`
in the plugin config to disable previews (including the generic preview resource
path). Adapter resources declare `policy: "metadata" | "preview" | "sql"`;
the plugin enforces preview/SQL flags against the discovered policy, never a
hardcoded resource ID. Policies are trusted adapter declarations, not a sandbox.
Untagged legacy resources remain available for compatibility; authors must tag
sample-data and SQL resources accurately for these switches to cover them.
`sensitiveColumns` configures case-insensitive field-name redaction before
tool results are saved or sent to the model. Defaults include email, phone,
address, SSN, birth date, card number, and first/last name; known credential
fields are always redacted. This is not a comprehensive privacy filter: aliases,
free text, schema comments, nested arrays or unrecognized names may still expose
sensitive data. Share only data authorized for the selected model provider.

### Read-only SQL setup

SQL is disabled by default. To enable PostgreSQL SQL, set both flags in your
existing `dsui.yaml` entries (merge these into your configuration):

```yaml
plugins:
  ai-agent:
    config:
      allowReadOnlySql: true
services:
  - id: postgres-spotify
    connection:
      allowAgentSql: true
```

Use a dedicated least-privileged PostgreSQL role with SELECT access only to the
intended tables, not a superuser. Elevated roles and server-file/program roles
are rejected. Use trusted schemas/views and do not grant access to dangerous
SECURITY DEFINER functions. This is not a sandbox for an untrusted database.
Connections scoped to one selected database cannot target other databases.

The PostgreSQL `query-readonly` resource accepts one SELECT/WITH query, runs it inside a PostgreSQL
`READ ONLY` transaction on a dedicated short-lived connection, and uses
`pg_catalog` as the search path: table names must be schema-qualified. Only
allowlisted built-in functions are accepted; comments, semicolons, dollar
quoting, backslashes and quoted function calls are rejected conservatively.
The default statement timeout is 5 seconds (maximum 10 seconds, never above the
service's `statementTimeout` setting); lock timeout is 1 second. At most 200 rows are
returned (default 50), with explicit truncation and a 1 MB serialized result
limit. These are output limits, not a database memory quota. Stop/disconnect
cannot forcibly cancel a resource read; the database statement timeout remains
the execution bound. SQL uses the same service/context permissions as other
tools. DuckDB SQL is unsupported because its general-purpose query runner can
access files, extensions and external systems.

[PostgreSQL's read-only mode](https://www.postgresql.org/docs/current/sql-set-transaction.html)
blocks database mutations but does not prevent every disk or external side
effect; role privileges and trusted database objects remain important.

No mutation actions, shell, filesystem, web-search or model-generated code
execution tools are enabled. Adapter resource authors
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
