# dsui adapter template

This is the starting point for a server-only dsui adapter. It may declare capabilities and their presentation metadata, but it may not ship React, browser JavaScript, native addons, lifecycle scripts, or arbitrary UI bundles. dsui owns navigation, rendering, accessibility, and the browser trust boundary.

## Implementing capabilities

Use a built-in `CapabilityView.kind` and describe columns, filters, and actions. A Trino adapter can expose `query`, `schema-browser`, and `table-browser`; another system can expose `job-browser` or `key-value-browser`. Add a new renderer to dsui core only when several adapters need it.

Each operation must validate input, bound result size, support cursors where applicable, respect `AbortSignal`, and return secret-free errors. Mark connection fields and every nested secret in `secretPaths`.

## Publishing

Build a single ESM bundle with `bun run build`, compute its byte count and SHA-256 for `dsui.adapter.json`, generate an SPDX SBOM, and publish from trusted CI with npm provenance. Publish no source maps or native binaries. A deployment pins the npm package, exact SemVer version, and npm SHA-512 SRI:

```yaml
adapters:
  example:
    source: npm
    package: "@your-org/dsui-adapter-example"
    version: "0.1.0"
    integrity: "sha512-REPLACE_WITH_NPM_DIST_INTEGRITY"
services:
  - id: example
    adapter: example
    connection:
      endpoint: ${EXAMPLE_ENDPOINT}
      token: ${EXAMPLE_TOKEN}
```

`@github_name/github_adapter` is an npm scoped-package name, not permission to clone a GitHub repository at runtime. Git URLs, branches, tags, arbitrary tarball URLs, and OCI images are intentionally unsupported.
