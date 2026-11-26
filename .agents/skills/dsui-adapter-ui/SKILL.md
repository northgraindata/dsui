---
name: dsui-adapter-ui
description: Use when adding or changing the UI of a DSUI adapter page or a shared UI component - composing pages, choosing or creating components, styling, spacing and responsive layout.
---

# Build adapter UI

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

## Layout contract

Follow [agents/rules/ui-layout.md](../../../agents/rules/ui-layout.md).

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
