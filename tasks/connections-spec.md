# Connections UI

## Objective and acceptance

Recreate `new service and connection form ui.png`: navy adapter marketplace,
separate rounded cards with Connect buttons, and a centered modal with a branded
header, vertical Connection / Test / Finish steps, form, About panel, and footer.
Use existing adapter metadata and connection APIs. The screenshot governs visual
choices where older DESIGN.md guidance differs. Catalog contents reflect installed
adapters; do not invent supported integrations, billing, or user identity.

The dialog must support all existing grouped and ungrouped connection methods,
required fields, optional advanced settings, health testing, retry, creation,
closing, keyboard focus containment/restoration, and narrow viewports. Test is a
real request; Finish follows a successful save. Credentials never appear in the
success summary. A server file path is entered as text; a browser file picker
cannot select files on the dsui server. Unsupported default-schema configuration
must not be presented as working.

## Structure and style

`apps/web/src/components/AdapterMarketplace.tsx` owns loading and selection;
`ConnectionDialog.tsx` owns the form and step lifecycle; `connections.css` owns
scoped reference styling. Existing UI primitives and API contracts are reused.
Use typed React components, e.g. `function ConnectionDialog({ adapter, onClose }:
{ adapter: Adapter; onClose(): void })`. No new dependencies or backend contracts.

## Plan

1. Replace the adapter chooser with the marketplace and route Adapters to it.
2. Implement the connection dialog and real test/create progression.
3. Compare rendered desktop/mobile layouts and exercise keyboard, errors, retry,
   method switching, and save. Inspect the final diff.

## Commands and testing

- `bun run --filter @northgraindata/dsui-web typecheck`
- `bun run --filter @northgraindata/dsui-web test`
- `bun apps/web/test/connections.browser.ts` (Vite running on port 5173)
- `bun run check`
- `bun run build`

Browser checks use Playwright already present in the workspace and mock only HTTP
boundaries, rendering the real app. Screenshots go to `/tmp/dsui-connections-*.png`.
Always preserve existing edits and test observable behavior. Ask before adding
new dependencies or changing server contracts. Never add fake successful actions,
expose secrets in summaries, or weaken checks.
