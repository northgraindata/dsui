# DSUI Agent

User-initiated chat for investigating a DSUI workspace. The launcher, drawer,
conversations, instructions and tools belong to this plugin. The host contributes
only generic `app.shell.actions` and overlay slots plus permission-checked SDK
capabilities.
No jobs, subscriptions, signal monitoring or autonomous background investigations
are registered.

## Replies and quotes

Use **Reply** below any completed message, or highlight text in an agent answer
and choose **Reply to selection**. The composer previews the quoted context;
use its × button to cancel without deleting your draft. Replies are stored with
the message, passed to the model as separate quoted context, and link back to
the original message. Switching tabs preserves each tab's pending reply; closing
its tab discards the unsent draft and reply. A failed send preserves it for retry.

Selections are limited to 4,000 characters and must stay within one answer.
Whole-message quotes are capped at 16,000 characters with an explicit truncation
marker. The server resolves source IDs only within the authorized conversation.
Rendered excerpts are user-provided text, not independently verified evidence or
instructions. Old conversations without reply metadata remain compatible.

## Chat names and workspace access

Open conversation history and use the pencil button to rename a chat (1–70
characters). Names are persisted per user; finish or stop a running response
before renaming it. The current chat name appears below the panel header. For
a new chat, the configured model generates a short title from the first prompt
and attachment names while the first answer runs. If that extra model call
fails or times out, the chat remains **New chat** and can be renamed manually.

The tab bar above the conversation keeps multiple chats open. **New chat** opens
another tab; selecting a chat from history opens it or activates its existing
tab. Each tab keeps its draft, attachments, quoted reply, model and scroll
position. Every chat can inspect all services the current user can access.
Responses can run in different tabs at the same time. Close a tab with
its × button; saved chats remain available in history and running responses
continue. Closing the last tab opens a blank one. Tabs and unsent drafts last for
the current page session. Arrow keys, Home/End and Delete work on focused tabs.

Schema-summary tables use fixed column proportions to align adjacent summaries;
data-preview tables retain their content-based layout.

The **Messages** menu beside the current chat name lists numbered previews of all
user messages, including attachment-only prompts. Search or select a preview to
jump to that prompt and its following response. Reading older messages pauses
automatic scrolling; scroll back to the bottom or send another message to follow
the latest response again.

## Agent skills

The agent's always-on Markdown response format lives in
`src/skills/response-format.md`. Task guides live beside it:
`diagnose-health.md`, `inspect-catalog.md`, and `compare-services.md`.
`list_skills` returns their IDs and descriptions; `read_skill` loads one guide
for a relevant task. Both tools read packaged plugin content only. A skill
describes a workflow, while live claims still require capability and DSUI tool
evidence. Skill reads count toward `maxToolCalls`.

## Service resources and actions

The agent uses generic host catalogs for services and plugins. It discovers
their resources and actions, then calls them through the Plugin SDK. Plugin
authors do not need agent-specific resources or dependencies. The host keeps
credentials private, checks the caller's permission, and validates every input
against the declared schema.

Resource search and batch reads are agent-side conveniences over those generic
catalogs and query operations. Outputs are bounded and sensitive fields are
redacted before tool results are stored or sent to the model.

## Development

From the repository root, using the pinned Bun version:

```sh
bun install --frozen-lockfile
bun run dev
```

The server builds this plugin from its configured local source on startup, using
the same plugin build pipeline as other source plugins. Restart DSUI after
editing it. AI SDK's `ToolLoopAgent` runs directly inside the plugin on Bun.

Add this to your `dsui.yaml` (also present in `examples/data-stack/dsui.yaml`):

```yaml
plugins:
  ai-agent:
    source: local
    path: packages/plugin-ai-agent
    enabled: true
    config:
      model:
        provider: openai
        id: gpt-6-sol
        apiKey: "${DSUI_AGENT_API_KEY}"
```

`provider` supports `openai`, `anthropic`, `gateway`, or `openrouter`; use a model ID available
to your provider (Gateway IDs include the provider prefix). OpenAI and Anthropic
use their direct provider APIs; Gateway is used only when explicitly selected.
You can put your key directly in YAML, but environment interpolation avoids
committing it. Restart DSUI after changing configuration. The browser receives
only whether a key is configured, never the key itself. Treat YAML and plugin
storage as secrets. Without a key, the drawer still opens for setup.

For OpenRouter, set `provider: openrouter`, use its model ID (for example
`~openai/gpt-sol-latest`), and set `apiKey: "${OPENROUTER_API_KEY}"`. Requests use
OpenRouter's Chat Completions endpoint at `https://openrouter.ai/api/v1`.

Optional configuration: `maxToolCalls` defaults to `20`; `timeoutSeconds` defaults
to `120`. The tool-call count is enforced separately from the model-step limit.
After the budget is spent, the next generation is text-only.

### Multiple models

Add named entries under `plugins.ai-agent.config.models` to enable the composer
model picker. Each entry has a unique `key`, optional display `label`, `provider`,
provider model `id`, and server-side `apiKey`:

```yaml
plugins:
  ai-agent:
    source: local
    path: packages/plugin-ai-agent
    enabled: true
    config:
      models:
        - key: fast
          label: Fast
          provider: openai
          id: gpt-6-luna
          apiKey: "${DSUI_AGENT_API_KEY}"
        - key: detailed
          label: Detailed
          provider: openai
          id: gpt-6-sol
          apiKey: "${DSUI_AGENT_API_KEY}"
```

Use model IDs available to your provider/account. Models can use different keys
or providers. Entries without an API key are not offered. The first configured
entry is the default. The legacy `model` config remains supported and, if it has
a key, appears first with the reserved picker key `default`.

Selection applies to the next message in the same chat and is remembered when
that message is sent. It cannot change a response already running. Each new
answer records its model/provider; previous answers are unchanged. Only model
keys, labels, provider names and IDs reach the browser, never API keys. Clients
cannot request unconfigured model IDs or override credentials. Restart DSUI
after changing the model list.

## Service mentions

The drawer is chat-only, without Chat, Tools or Insights tabs. Type `@` in the
composer to search accessible configured services by name or ID.
Select with the mouse, Arrow keys and Enter/Tab; Escape dismisses suggestions.
Mentions are highlighted while typing and in conversation messages.

Friendly handles use service names, such as `Analytics Prod` becoming
`@analytics-prod`.
Duplicate names fall back to service IDs; `@<service-id>` is always accepted.
The backend resolves mentions independently against the caller's visible services.
Unknown or inaccessible mentions are rejected. A mention tells the agent where
to start looking; it does not restrict the rest of the workspace. Tool access
continues to be checked against the current user's permissions.

## Table links

The agent receives navigation links alongside resource reads and is instructed to make table names clickable in its
Markdown answers. Only the table name is linked, directly in its existing cell;
there is no separate link column or "Open table" action.
Clicking a link opens that service's table page in the same
tab, including identifiers provided in the navigation metadata.

Providers may return optional `navigation` entries containing `label`, a
provider-relative `path`, and identifying fields. After permission checks, the
plugin prefixes paths with the service URL and rejects paths that escape it.
Resources without verified navigation fall back to service links.
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

The agent can discover services and plugins, inspect both catalogs' resources
and actions, query declared resources, and execute declared actions when the
user requests them and has permission. The host validates each input and
enforces permissions on every operation. Discovery alone does not grant action
execution.

Resource and action IDs are always discovered from the host catalogs. The agent
has no provider-specific branches or connection credentials. To expose a
capability to the agent, declare it through the ordinary resource or action
contract.

Tool results are bounded before persistence and model delivery. Sensitive field
names are redacted using the `sensitiveColumns` setting; known credential fields
are always redacted. This does not identify every sensitive value in arbitrary
text, nested payloads, or schema comments, so use a model provider authorized to
receive the queried data.

## Manual verification

```sh
bun run --filter @northgraindata/dsui-plugin-ai-agent typecheck
bun run --filter @northgraindata/dsui-plugin-ai-agent build
```

Automated agent tests are deferred for now. Check the live integration by sending
two messages with a valid provider key, testing Stop, and reopening the drawer.
Typechecking and bundling alone do not verify a live provider response.
