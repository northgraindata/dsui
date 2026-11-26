# Radix spike

**Question:** should DSUI primitives with hard behaviour move to Radix, styled through our own variants?
**Status:** waiting for the maintainer's decision.
The product is unchanged: the spike lives in `apps/gallery/spike/`.

Open it with `bun run gallery:dev` at `http://localhost:5180/?spike=1`.

## Results

| Criterion | Result |
| --- | --- |
| 1. Looks like ours, new variants are cheap | Passed. Two variants and two sizes with `cva` and our tokens. |
| 2. Works in the app and in a plugin bundle with one React | **Passed only when the host supplies the component.** |
| 3. Keyboard and modal | Passed. See below. |
| 4. Published SDK and bundle size | Size measured. **The SDK package was not tested**, because the spike does not change `packages/ui`. |
| 5. Less code to maintain | Promising, not proven. |

### Plugins

Both test plugins were built with the flags the server uses: `bun build --target browser --external "*.css"`.

| Plugin | Bundle | In the browser |
| --- | --- | --- |
| Imports the Radix component | 310 KB, 36.8 KB gzip minified | Fails: "Invalid hook call". The bundle carries its own React. |
| Receives `ui.Select` from the host | 284 B | Renders and opens. |

The second form needs a contract change: `createComponents(React, ReactDOM, ui)`.
The host passes only the first two arguments today.

Not tried: marking `react` as external in the server's plugin build and resolving it with an import map.
It would let plugins import components normally, but it changes how every plugin bundle is built and loaded.

### Keyboard and modal

- Opening a list and choosing with the keyboard worked in 10 of 10 runs.
- A tooltip appeared on keyboard focus.
- In a modal, the list drew on top. The first Escape closed the list and the second closed the modal.

### Limitation: empty values

Some of our pickers use `""` for a default, such as "Configured database".
With `@radix-ui/react-select` 2.4.1 the option appears in the open list.
The closed trigger shows the placeholder instead of its label.
A wrapper would have to map `""` to an internal value.

### Size and code

- `Select`, `Tooltip` and `cva` without React: 103 KB minified, 35.6 KB gzip. The app already ships Radix Dialog, so shared parts make the real increase smaller. That increase was not measured.
- The spike components are 102 lines. `option-select-factory.tsx` is 257 lines, plus its CSS.
- This is not a like-for-like comparison. The spike has no option icons or descriptions, and no form `name` or `required`.

## Recommendation

Adopt Radix for Select, Dropdown menu, Popover, Tooltip, Alert dialog and Tabs.
Give plugins those components through the host, as `ui`.
That also keeps one dialog and toast behaviour across plugins.

The cost is a new part of the plugin contract that the host must keep stable.
Before migrating, check the SDK package, the empty value wrapper and form support with the first real component.
