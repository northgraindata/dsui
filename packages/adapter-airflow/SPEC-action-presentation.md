# Spec: Airflow Action Presentation

## Objective

Make Airflow operational pages faster to scan without adding provider-specific
browser code. DAG and task actions keep visible text labels and gain compact,
semantic icons. Tables show curated columns instead of every provider field, and
page descriptions explain the current resource and available operation.

## Tech Stack

TypeScript, React 19, the existing adapter SDK/core page protocol, renderer, UI
primitives, Tailwind tokens, Bun Test, and no new dependencies.

## Commands

- SDK tests: `bun run --filter @northgraindata/dsui-adapter-sdk test`
- SDK typecheck: `bun run --filter @northgraindata/dsui-adapter-sdk typecheck`
- Renderer tests: `bun run --filter @northgraindata/dsui-renderer test`
- Renderer typecheck: `bun run --filter @northgraindata/dsui-renderer typecheck`
- Airflow tests: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Airflow typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Web tests: `bun run --filter @northgraindata/dsui-web test`
- Web typecheck: `bun run --filter @northgraindata/dsui-web typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `packages/core/src/page-document.ts`: browser-safe semantic icon contract.
- `packages/adapter-sdk/src/components/`: authoring types and serialization.
- `packages/renderer/src/`: allowlisted icon rendering and compact action groups.
- `packages/adapter-airflow/src/pages/`: Airflow labels, descriptions, columns,
  variants, and icon declarations.
- Colocated package tests verify each affected boundary.

## Code Style

```ts
Table({
  source: dags(),
  columns: [{ id: "name", label: "DAG" }],
  rowActions: [
    { label: "Trigger", icon: "play", action: triggerDag, input: { dagId: "dagId" } },
  ],
});
```

Adapters declare semantic intent only. The renderer owns SVG paths, spacing,
loading feedback, focus treatment, and responsive presentation.

## Testing Strategy

Follow RED → GREEN → REFACTOR. SDK tests prove icons survive serialization;
renderer tests cover the allowlist and accessible label output; Airflow page tests
assert useful columns, descriptions, variants, and action icons. Browser smoke
checks cover keyboard focus and 320px, 768px, 1024px, and 1440px layouts.

## Boundaries

- Always: retain visible action text, use semantic tokens, keep icons decorative
  to assistive technology, expose loading/error feedback, and use existing UI
  primitives.
- Ask first: add a dependency, introduce icon-only destructive actions, or add a
  new page-node kind.
- Never: branch on adapter/action ids in the renderer, serialize SVG/HTML/CSS,
  hide action meaning behind color alone, or make whole table rows compete with
  their action buttons for pointer activation.

## Success Criteria

- Button and table-row action documents accept an optional allowlisted icon and
  serialize it without changing existing nodes.
- Airflow Trigger, Pause, Unpause, Retry, and Clear controls render with an icon
  and visible label, preserve keyboard operation, and show in-progress state.
- Airflow DAG, run, task, asset, and event tables declare concise columns with
  readable labels; pages include short descriptions and detail section titles.
- Existing adapters without icons render unchanged.
- Focused tests, typechecks, root checks, build, and browser verification are run
  or any limitation is reported.

## Open Questions

None. The approved scope keeps visible labels and adds icons as scanning aids.
