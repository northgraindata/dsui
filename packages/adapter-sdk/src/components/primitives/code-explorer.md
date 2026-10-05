# CodeExplorer

A read-only source browser for adapters and plugins. The source owner supplies
file metadata and a resource that reads one file; the component handles browsing,
search, breadcrumbs and a Monaco preview. It does not fetch repositories or know
provider credentials.

```ts
CodeExplorer({
  title: "Project source",
  files: [{ path: "src/index.ts", size: 120 }],
  path: params.path,
  basePath: "source/files",
  file: { resourceId: "source-file", input: { projectId } },
  version: snapshotVersion,
});
```

Paths are relative to the source root. The component adds `path` to the file
resource input. The response contains `content?: string`, `size?: number`,
`language?: string`, and `reason?: string`. Use `reason` for binary files or files
that exceed the source's preview limit. Validate paths and enforce authorization
and preview limits in the resource handler.

`basePath` is passed through the host client's navigation function with each file
path segment encoded. Support a wildcard page parameter for nested paths.
`#L123` reveals and selects a line; clicking a Monaco line number updates the hash.
Monaco provides find, folding and selection; the preview also supports copying
and wrapping lines. Editor/model instances are disposed on file changes.

Changing `version` refetches the selected file. Empty sources, errors and loading
have explicit states. Source discovery, refresh controls and source-specific
metadata belong to the calling adapter or plugin.
