# 0006: Code editor highlighting (modern-monaco + Shiki)

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

`CodeEditorProps.language` exists but is not wired to any highlighter, so SQL and
other code render without syntax highlighting. The editor is used by many adapters
(SQL for DuckDB/Snowflake/Postgres, JSON, and more), so the language must be passed
as a simple adapter-supplied argument, never as adapter code or markup.

## Decision

Use `modern-monaco` as the editor. Its lazy editor path provides Shiki-powered
highlighting, so DSUI does not need a second highlighter integration.
`CodeEditorProps.language` becomes a Shiki/Monaco language id
(`sql`, `json`, `python`, ...); adapters pass only the id string. Grammar sets are
tree-shaken to the languages actually referenced, with a graceful fallback for
unknown ids.

## Alternatives

- **Shiki-only highlight layer**: shiki is a highlighter, not an editor; pairing it
  with a full editor (modern-monaco) satisfies editing plus highlighting and enables
  future autocomplete.
- **CodeMirror**: viable, but modern-monaco was explicitly selected for consistency
  and expected features.
- **Per-adapter grammars**: adapters must not ship executable or frontend code; a
  string language id keeps them declarative.

## Compatibility and rollout

A renderer-side dependency addition (`modern-monaco`).
The SDK's `CodeEditorProps` shape is unchanged; only the renderer interpretation of
`language` becomes meaningful. Bundle size is tracked via the existing bundle-report
script.

## Verification

Smoke test that SQL highlighting produces tokens; language passthrough from adapter
definition to renderer; unknown-language fallback renders without errors; bundle
size recorded.

## Consequences

Monaco and its language support are a renderer cost paid once for all adapters.
Autocomplete (completions per language) is enabled by this stack but remains separate
follow-up work.
