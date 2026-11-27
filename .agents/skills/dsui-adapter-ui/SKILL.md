---
name: dsui-adapter-ui
description: Use when adding or changing the UI of a DSUI adapter page or a shared UI component - composing pages, choosing or creating components, styling, spacing and responsive layout.
---

# Build adapter UI

## A new adapter or a redesign

Work in this order.
Get the maintainer's answer at steps 2 and 4 before you go on.

1. **Learn the tool.** Read its API specification and its own UI. List every state, run type and list it has, for each supported version (R27 to R29).
2. **Plan pages by question.** For each page, say what a person comes to find out or do. Drop pages that answer nothing. Propose the pages and the sidebar groups (R39).
3. **Prototype in the gallery.** Use data that looks real and is sized like a large company: hundreds of records, long names, many tags, every state, failures and none (R30 to R36). Mark invented data as invented.
4. **Show it.** Put the prototype beside the current pages with the Old and New switch (`apps/gallery/src/shell/embedded.tsx`). Report which values the API cannot give and which need extra requests. Change it with the maintainer until they accept the look.
5. **Build it for real.** Move what is reusable into shared components, make the adapter fetch what the design shows, and page every list that grows.
6. **Verify.** Test against the real tool where you can, and say so where you could not.

The look to match is the [reference design](../../../agents/rules/ui-conventions.md#reference-design).
Open it before you design anything.

### Before you show a design

- Hover every dense mark and open every select: nothing is cut off, covered or unlabeled.
- Check it with no failures, with many, and with an empty list.
- Check a long list, a record's way back to it, and a narrow window.
- Read every line of text: remove what only describes how the page works inside (R46).
- Take a screenshot of each page and look at it. A test can pass while a card has lost its styles.

## Find what exists first

- Components an adapter can use are declared in `packages/adapter-sdk/src/components/primitives/`.
  Each file holds the props type with its JSDoc.
- Their browser views are listed in `packages/adapter-sdk/src/components/ui/registry.tsx`.
- Props and examples for readers live in `apps/docs/src/content/components/<name>.json`.
- To see a component on a real page, run `bun run gallery:dev` and search the page JSON in `apps/gallery/.generated/` for its kind or id.

## Reuse, extend or create

1. Compose existing primitives. Most pages need nothing else.
2. If one prop is missing, add it to the primitive and its view.
   Serialization needs no change unless the protocol shape differs from the authoring props.
3. Create a shared primitive only when more than one adapter needs it.
   Add the view to the registry, its styles to `adapter-sdk/src/styles/`, and a docs JSON file.
4. Keep a custom component inside its adapter only for something domain-specific, such as a dependency graph.

## Layout and behaviour

Follow [agents/rules/ui-layout.md](../../../agents/rules/ui-layout.md) and the [UI conventions](../../../agents/rules/ui-conventions.md).
Most conventions are not built yet: do not claim a page follows one without checking.
When you bring an existing page up to them, follow the [page review](../../../agents/ui-review/README.md), which needs the maintainer's approval.

## Styling

- Shared component CSS lives in `packages/adapter-sdk/src/styles/`, with classes prefixed `dsui-`.
- Colors come from `--color-*` tokens declared in `packages/ui/src/styles.css`.
  Never write a raw color.
- Layout gaps come from `--spacing-inline`, `--spacing-compact`, `--spacing-component` and `--spacing-section`.
- External adapter bundles cannot ship CSS, and Tailwind only emits classes found in this repository.
  An external custom component composes builtins or uses inline styles with the color variables.

## Check data states

Fixtures are generated from resource output types, so a new page appears in the gallery without extra work.
Add `packages/adapter-<id>/fixtures/fixtures.ts` entries only for:

- route params that a resource input schema validates,
- query strings a page needs,
- resource data whose meaning the type cannot express.

Then verify the result with the `dsui-ui-review` skill.
