# DuckDB extensions list and details

Status: User approved restart semantics; implementation complete for maintainer review.

Implemented generic entity catalog/detail nodes, DuckDB presentation resources,
managed local/subprocess sessions, and confirmed restart actions. Focused tests,
browser interactions/responsive checks, and a disposable native DuckDB restart
probe passed. The investigation below records the original prerequisite.

## Unload/reload investigation

The user requested implementing these actions rather than leaving them disabled.
A disposable in-memory probe against the installed DuckDB v1.5.5 rejects both
`UNLOAD json` and `RELOAD json` with parser errors. No native unload/reload API
has been established.

The host currently creates and disposes an adapter instance for every resource
and action call (`packages/server/src/adapters/loader.ts`). Consequently, Load
does not retain session state for a subsequent resource request. The subprocess
host likewise serves a single request. Adding two action handlers cannot deliver
the requested persistent behavior.

A candidate approach requires managed session lifetime and controlled restarts:
reload recreates the instance and restores an explicitly managed extension set;
unload recreates it without the selected dynamically loaded extension. Built-in
extensions and automatic extension loading need separate capability rules.
Restarting can discard in-memory databases, temporary objects, transactions,
attachments, and session settings. This must not happen behind an ordinary
Unload label without an explicit restart confirmation and clear scope.

Before implementation, resolve whether restart-based behavior is acceptable.
If approved, specify the generic host session lifecycle, concurrency, cancellation,
cleanup, isolation, and state restoration as a separate prerequisite with a
decision record and integration tests for both execution backends. Preserve
the original list/detail UI objective alongside this prerequisite.

## Objective

Replace the existing `/extensions/:extension` detail page with the supplied
`duckdb extension details.png` design. The 1536 × 1024 reference is the desktop
visual acceptance target. Preserve existing deep links and extension actions.

The scope also includes replicating `duckdb extensions list.png`, supplied at
1536 × 1024.
Preserve list-to-detail navigation and existing Install/Load behavior throughout.
Prefer generic components shared by the list and detail views where their semantics
match, without introducing abstractions solely for hypothetical future consumers.

## Visual acceptance criteria

### Extensions list

- Match the supplied list reference at 1536 × 1024: 64px topbar, 245px rail,
  content beginning at x=271px and ending near x=1508px, navy background artwork,
  fine dividers, compact typography, and blue active states.
- Header uses an 80px adapter mark, DuckDB title, Manage extensions subtitle,
  supporting description, and right-aligned Install extension button.
- Filter row provides All extensions, Installed, Available, Official, Community,
  a search input, and category selector. Filters combine, retain keyboard access,
  and show an explicit empty result state. Classification must come from verified
  metadata; never infer official/community from the extension name alone.
- Table has Name, Description, Category, Status, Version, Actions columns;
  approximately 56px rows with circular icons, provenance badges beneath names,
  category badges, status dots and labels, primary actions, and overflow menus.
- Name links open the corresponding detail route. Row controls must not trigger
  navigation. Overflow menus contain only meaningful, supported actions.
- Install extension opens an accessible selection/input flow using the existing
  install action. Existing installed/loaded state determines available actions.
- Preserve the visual slots for unavailable Unload actions with clear disabled
  states as specified below. Screenshot versions and statuses are visual fixture
  data, not runtime defaults.
- On narrow screens, controls wrap and the table uses a contained horizontal
  scroll area without causing page-wide overflow.

### Extension details

- Match the dark navy canvas, thin blue-gray borders, compact typography, icon
  treatment, translucent panels, and spacing shown in the reference.
- Reference geometry: 64px topbar, 245px navigation rail, content starting at
  x=271px, 27px right margin. Main overview columns are approximately 799px and
  418px wide with a 17px gap. Use fluid sizing outside the reference viewport.
- Header: breadcrumb, 72px icon tile, extension name, live status badge,
  description, tags, installed-version control, and action area.
- Five tabs: Overview, Configuration, Examples, Dependencies, Changelog.
  Tabs must expose meaningful content or an explicit unavailable state, support
  keyboard navigation, and retain the extension identity while switching.
- Overview left column: About with documentation/source/license links, six
  metadata tiles, three quick actions, Usage with two SQL blocks and copy buttons.
- Overview right column: Status, supported storage systems, Configuration,
  Related extensions with state-aware installation actions.
- Match httpfs content using verified extension documentation; other extensions
  use their own metadata and never inherit httpfs-specific claims.
- At 1024px, 768px, and 320px adapt columns and navigation without horizontal
  page overflow. Preserve readable code using local horizontal scrolling.

## Data and behavior

- Use real installed, loaded, version, and description values. Missing metadata
  is shown as unavailable, never populated with the screenshot's sample values.
- The current client implements Install and Load only. Retain the reference's
  action positions, but disable unavailable Unload/Reload with an accessible
  explanation unless actual support is verified during implementation.
- Do not label a version latest without a verified version source. Do not invent
  installation size, load timestamps, dependency lists, or changelog entries.
- Configuration exposes only verified settings relevant to the selected extension;
  never expose secrets or imply that an unknown configuration is empty.
- Related-extension installation runs only after an explicit user action, displays
  progress/errors, and refreshes relevant status. Copy buttons copy the displayed
  SQL and provide accessible feedback.
- Unknown extensions, loading, errors, navigation between extension identities,
  and pending actions have explicit UI states.

## Architecture and project structure

Adapter-owned metadata/resources/actions and page composition live under
`packages/adapter-duckdb/src`. React presentation remains in `packages/renderer`,
with shared styles in `packages/ui`. App chrome changes live in `apps/web` and
must be scoped so other pages retain their existing layout.

Reuse existing declarative nodes where they fit. Any necessary generic detail
presentation additions must span core wire types, SDK factories/serialization,
renderer implementation, documentation, and tests together. Record the contract
change in a decision record. Do not add DuckDB operation-name branches in the
browser or ship adapter-owned React/HTML.

## Commands

- `bun run --filter @northgraindata/dsui-adapter-sdk test`
- `bun run --filter @northgraindata/dsui-adapter-sdk typecheck`
- `bun run --filter @northgraindata/dsui-adapter-duckdb test`
- `bun run --filter @northgraindata/dsui-adapter-duckdb typecheck`
- `bun run --filter @northgraindata/dsui-renderer test`
- `bun run --filter @northgraindata/dsui-renderer typecheck`
- `bun run --filter @northgraindata/dsui-web test`
- `bun run --filter @northgraindata/dsui-web typecheck`
- `bun run check`
- `bun run build`

## Code style

Follow repository TypeScript, Bun, Biome and semantic UI tokens. Example of
adapter-owned composition:

```ts
Section({
  title: "About",
  content: KeyValue({ source: extensionDetails({ name: params.extension }) }),
});
```

This illustrates ownership and style, not the final About presentation.

## Verification strategy

Write failing behavior tests before implementing metadata transformations,
action state refresh, and any contract additions. Exercise actual serialization
and malformed payload rejection. Use browser checks for tabs, copy, loading/error
states, keyboard focus, action feedback, and deep-link navigation. Capture the
1536 × 1024 httpfs page with deterministic test metadata matching the reference
and inspect it side by side; separately verify runtime metadata. Capture responsive
screenshots at the other target widths. Report visual deviations and unrun checks.

## Boundaries

- Always preserve concurrent workspace changes and inspect the final task diff.
- Always keep actual values and capability limitations truthful.
- Ask first before expanding into connection lifecycle changes, adding dependencies,
  or destructive database operations.
- Never fabricate working controls, weaken tests, leak secrets, or replace unrelated
  in-progress work to achieve a screenshot.

## Proposed implementation sequence

1. Define and test the minimal generic presentation contracts; document the decision.
2. Implement renderer components/styles and browser interaction coverage.
3. Compose the DuckDB detail page with verified metadata and existing actions.
4. Align the scoped chrome and spacing with the reference; inspect screenshots.
5. Run focused and root checks, review the diff, and provide review artifacts.

## Review decision

Approve the visual and implementation scope, including explicit unavailable states
for reference controls/data the running adapter cannot truthfully provide.
Both visual references have been supplied. Specification approval remains pending.
