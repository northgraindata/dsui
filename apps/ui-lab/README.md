# DSUI UI Lab

A local React/Vite workshop for production components, SDK blocks, design tokens
and reference dashboards. No backend, login, live connections or Storybook.

From the repository root:

```sh
bun install --frozen-lockfile
bun run ui-lab
```

Open the URL printed by Vite (normally `http://localhost:5175`). Changes to shared
components and styles update through Vite HMR. The app also participates in the
root dev, build, typecheck and test commands.

## Browse

- **Foundations:** semantic colors read from the production CSS, fonts, layout
  gaps and surface conventions. Non-tokenized sizes are labeled as conventions.
- **UI components:** individual exports of `packages/ui`, with variants and
  supported states visible together.
- **SDK blocks:** the public SDK primitives rendered through the production
  serializer and component registry. Data-bound examples include normal, empty,
  pending, error and stress fixtures.
- **Dashboards:** the production Monitoring composition and Health component,
  plus a reference database workspace built from production SDK blocks.

Previews use same-origin iframes to isolate portals, focus and IDs. Browser preferences remain shared.
Choose Fluid or 390px to exercise actual viewport media queries. Each example
has a direct link; Reset examples reloads its local state. Interactions never
contact an application API: fixture actions and navigation are handled locally.
The dialog has both an open and a closed example.

## Add or change examples

Entries are ordinary typed objects, not generated documentation:

- [UI examples](src/ui-catalog.tsx)
- [SDK examples](src/sdk-catalog.tsx)
- [Dashboards](src/dashboards.tsx)
- [Fixtures and local client](src/fixtures.ts)
- [Foundations](src/foundations.tsx)

Add a named example to an entry's `examples` array. Its `render` function receives
one of the fixture scenarios and returns React content. For SDK content, use the
SDK factories and `NodePreview`; it serializes the nodes before rendering them.
Add explicit fixtures when a component needs another resource or action. Unknown
IDs throw rather than silently return empty data. Data values are deterministic;
series timestamps are anchored to the current minute so live charts remain visible.

Prefer importing the production composition. Monitoring separates its view from
host sampling; Health initializes its existing browser React bridge. Keep server
resource modules out of browser imports. The database example is deliberately
identified as a reference composition, not a real adapter page.

## Checks and current limits

```sh
bun run --filter @northgraindata/dsui-ui-lab typecheck
bun run --filter @northgraindata/dsui-ui-lab test
bun run --filter @northgraindata/dsui-ui-lab build
```

Tests check resource/action behavior, public component coverage and server rendering
of every example through Vite and the production renderer. A new SDK primitive or
shared UI component without an entry fails coverage. These checks do not replace
browser interaction or visual regression tests.

The standalone `CodeEditor` primitive is explicitly documented as a gap: the
production serializer rejects it. `QueryEditor` provides the working editor preview.
Loading/error fixture names describe the client response; components show their
existing production behavior. For example, Chart currently presents an empty
message for loading and failed reads. The workshop makes those gaps inspectable
without introducing replacement UI. Interactive success/error results appear after
submitting a form or running a query. No screenshot comparison is configured yet.

The static build includes the existing chart and editor dependencies. It can be
previewed with `bun run --filter @northgraindata/dsui-ui-lab preview`.

## Optional DSUI Pro examples

The **DSUI Pro** section loads actual components from a separate private checkout:
AI Investigator, new investigation, finding report (final/draft/inconclusive),
CSV report preview, progress phases, evidence, tables, logs, timeline and workflows.
All use synthetic local fixtures; supported actions only report a local result.
Loading/error examples of the composer become visible after submitting it.

```sh
DSUI_PRO_DIR=/absolute/path/to/dsui-pro bun run ui-lab
```

Alternatively set `DSUI_PRO_DIR` in `apps/ui-lab/.env.local` (gitignored), then use
`bun run ui-lab`. Restart Vite after changing this setting. It must point to the
checkout root, not the plugin directory. Without a checkout, these entries explain
how to enable them; the rest of the Lab works normally.

The Vite bridge imports Pro source without copying it into DSUI. Pro builds include
those private browser components in the ignored static output. The existing Pro
icons and syntax highlighting use `lucide` and `highlight.js`; they are only bundled
when Pro is enabled. Pro fixtures are parsed by the checkout's own model schemas,
so incompatible contract changes fail the catalog render test. Lab test/build caching
is disabled because the external checkout is outside Turbo’s input graph.

```sh
DSUI_PRO_DIR=/absolute/path/to/dsui-pro bun run --filter @northgraindata/dsui-ui-lab test
DSUI_PRO_DIR='' bun run --filter @northgraindata/dsui-ui-lab test
```

## Official adapters and plugins

The **Coverage** foundation is the inventory, including explicit remaining gaps.
**Official adapters** imports 58 actual page definitions across Airflow, ClickHouse,
dbt, DuckDB, PostgreSQL and S3. `adapter-snapshots.ts` runs under Bun on Vite's
server side, serializes the pages, and sends only page documents to the browser.
No adapter connection or resource query is executed. Custom graph and S3 workspace
components use the existing production renderer registry. Adapter source edits
invalidate the generated module. Store-backed pages use their initial state.

`src/adapter-fixtures.ts` supplies generated presentation samples based on the
serialized consumers, plus structured resource examples. These are for visual
review, not backend contract validation. Add curated per-resource samples when
working on domain-specific details. Resource scenarios are normal, empty,
loading, error and stress; pages without remote data retain their static content.

**Plugins** includes the real AI Agent drawer/launcher and Code Repository
screens. With `DSUI_PRO_DIR`, Notifications, MCP, Auth, and additional Investigator
settings/full-run views use the private checkout's actual components. Auth sign-in
submissions are intercepted before reaching the component transport. Mutations
without a modeled result return an explicit local preview error. Navigation is
recorded rather than sent to the live host. The inventory does not claim every
interaction state is covered.
