---
name: dsui-ui-review
description: Use to verify DSUI UI changes in a real browser - fixture gallery, layout checks, screenshot comparison and lint diagnostics. Use before reporting any UI change as done.
---

# Review rendered UI

Reading source is not verification.
Render the page and look at it.

## Open pages

Run `bun run gallery:dev` and open `http://127.0.0.1:5180/`.
A fixture URL is `/?adapter=<id>&page=<slug>&scenario=<name>&width=<value>`.
Scenarios are `default`, `empty`, `loading`, `error`, `large` and `long-text`.
Widths are `360`, `768`, `1280` and `split`.
Set the browser viewport to the same width, or 1440 for `split`.

With a browser tool such as Playwright MCP, inspect screenshots, DOM, computed styles, element sizes and console output.

## Run the checks

```sh
bun run lint
bun run test:ui
```

`test:ui` rebuilds fixtures and checks every page in every scenario and width.
It fails on console errors, horizontal overflow and controls with zero size.

## Compare screenshots

Baselines depend on the platform, so they are not committed.
Create one from the code you started from, then compare:

```sh
cd apps/gallery
DSUI_VISUAL=1 DSUI_SNAPSHOT_DIR=/path/to/baseline bunx playwright test visual --update-snapshots
# make your change, run `bun run fixtures:build`, then:
DSUI_VISUAL=1 DSUI_SNAPSHOT_DIR=/path/to/baseline bunx playwright test visual
```

Open every diff and explain it.
A shorter or taller page can mean content disappeared.
The Dagster run graph can differ by a few hundred antialiasing pixels between identical runs.

If a result looks impossible, such as old class names in a failure, check that nothing else is serving port 5180.

## Resolve diagnostics

| Diagnostic | Fix |
| --- | --- |
| horizontal overflow | Find the first offender in the message. Give the grid or flex item `min-width: 0`, then let text wrap or truncate. Put wide tables in their own scroll box. |
| collapsed controls | A sibling took all the width. Let it shrink and give the control a flex basis. |
| `no-content-keys` | Key by position or identity with `components/ui/keys.ts`. |
| `no-raw-class-colors`, `color-no-hex` | Use a color token. Add one only if no existing token fits. |
| `declaration-strict-value` | Use a `--color-*` or `--spacing-*` variable. |
| `no-viewport-variants` | Use `@min-[…]/dsui-page:` or `@container dsui-page`. |
| `no-legacy-class-names` | Prefix shared classes with `dsui-`. |

A lint suppression needs a reason on the same comment.
