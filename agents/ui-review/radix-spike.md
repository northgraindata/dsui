# Radix spike

**Question:** should DSUI primitives with hard behaviour move to Radix, styled through our own variants?
**Status:** accepted on 2026-11-26, with components passed to extensions by the host.
`Select` has moved. The spike's prototype code is gone; the results below are what the decision was based on.

## Changes found while building the first component

- **Styles are plain CSS, not `cva` utility classes.** Extension stylesheets are unlayered, so a rule such as `.some-form button` beats any Tailwind utility. Variants are `data-variant` and `data-size` attributes.
- **A native `<dialog>` needs the list inside it.** The connection dialog opens with `showModal()`. A list in `document.body` would be drawn under it and be inert. The spike missed this, because it only tested the Radix dialog.
- **The kit's types live in `packages/ui/src/kit.ts`,** with no implementations. Plugins compile JSX against an injected React, so importing component sources would break their type check.
- **Empty values are handled** inside the component.

## Still to migrate

Dropdown menu, Popover, Tooltip, Alert dialog and Tabs. `SuggestInput` needs its own assessment, because Radix has no combobox.

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
