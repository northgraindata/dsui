# dsui adapter template

Starting point for a server-only dsui adapter. Declare resources (data),
actions (behavior), and pages (composition) with `@northgraindata/dsui-adapter-sdk`.
Never ship React, browser JavaScript, native addons, lifecycle scripts, or
arbitrary UI bundles: dsui owns navigation, rendering, accessibility, and
the browser trust boundary.

When copying this template out of the dsui repo, replace the
`workspace:*` SDK dependency with the published version range.

## Implementing the adapter

Model external data as resources, side effects as actions, and navigation
as pages. Validate every input with Zod, bound result sizes, respect
`AbortSignal` on long-running actions, and return secret-free errors.
Keep secrets out of logs and error messages: the server redacts nothing
for you, so never interpolate tokens into errors.

## Publishing

Build a single ESM bundle with `bun run build`, compute its byte count
and SHA-256 for `dsui.adapter.json`, generate an SPDX SBOM, and publish
from trusted CI with npm provenance. Publish no source maps or native
binaries. A deployment pins the npm package, exact SemVer version, and
npm SHA-512 SRI:

```yaml
adapters:
  example:
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

Pinned bundles run isolated in an `adapter-host` subprocess with no
access to the server process. In-process execution is reserved for
local packages.
