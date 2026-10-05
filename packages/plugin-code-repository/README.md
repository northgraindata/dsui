# Code repositories

Connect GitHub, GitLab, or a folder on the DSUI host to a service. Each service can
have several connections, each with its own branch, subfolder, instructions, and
refresh interval. Code is read only; projects are never installed or executed.

From this workspace, build the browser bundle with
`bun run --filter @northgraindata/dsui-plugin-code-repository build`, then configure:

```yaml
plugins:
  code-repository:
    package: "@northgraindata/dsui-plugin-code-repository"
    browserBundle: "@northgraindata/dsui-plugin-code-repository/browser"
    config:
      githubToken: "${GITHUB_TOKEN}"
      gitlab:
        - id: gitlab
          url: https://gitlab.com
          token: "${GITLAB_TOKEN}"
        # Additional HTTPS GitLab instances may be configured here.
      localRoots:
        - /home/operator/projects
```

For a source-built plugin, replace `package` and `browserBundle` with
`source: local` and `path: /absolute/path/to/packages/plugin-code-repository`.
The source builder produces both bundles. Docker and npm releases ship both
artifacts. Configuration changes take effect after restarting DSUI.

Tokens are optional for public repositories. GitHub tokens need read access to
repository contents. For GitLab API browsing, use a token with `read_api` scoped
to the required projects. Credentials stay in server configuration and are never
included in connection records or browser responses.

Open **Code repositories**, select a service, and connect code. Remote repositories
use a selected branch; local folders use their current contents, including files
not committed to Git. A local folder must be accessible to the DSUI process and
inside a configured `localRoots` directory. Local roots are disabled by default.

Snapshots are stored atomically in the plugin's private SQLite database. Fetches
run through durable jobs. The default interval is 15 minutes; 0 disables automatic
refresh. Failed fetches preserve the previous snapshot. Removed connections drop
their saved files. Missing services retain connection records with an error and
remain hidden from the overview until the service is restored.

Default limits are 64 MiB per snapshot and 10,000 files, adjustable through
`maxSnapshotBytes` and `maxFiles`. `.git`, `node_modules`, build outputs and caches
are excluded. Local symlinks are skipped. Binary files and text above 1 MiB show
metadata rather than a preview. Git LFS pointers are shown without downloading LFS
objects; submodule contents are not fetched.

Direct links include the service, connection, file path and optional `#L123` line.
A changed snapshot publishes `code-repository.updated` with service ID,
connection ID and version. No code content is included in the signal. Sharing
code with another plugin is a later integration; instructions are already saved
with the connection as context for that work.
