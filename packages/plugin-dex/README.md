# Dex plugin

Checks local dbt or warehouse projects with [Exmergo Dex](https://trydex.ai) and
shows whether each one is valid or has issues. Run a check yourself or on a
schedule, browse past runs, and look at the warehouse inventory, semantic
metrics, ER diagram (Mermaid source) and stored transform plans. The DSUI AI
agent can start checks and read the results.

DSUI does not change dbt files or the warehouse. Transform changes are not
included yet.

## Set up

1. Install Dex on the machine that runs DSUI, with the extra for your warehouse
   (`duckdb`, `postgres`, `snowflake` and so on). DSUI was checked against Dex
   1.19.0.

   ```sh
   uv tool install "exmergo-dex-core[duckdb]"
   ```

2. In your project, create `.dex/config.yml` with `dex init`. For the diagram,
   also run `dex explore map`.

3. Add the plugin to `dsui.yaml`, using absolute paths:

   ```yaml
   plugins:
     dex:
       source: local
       path: /absolute/path/to/dsui/packages/plugin-dex
       config:
         executable: /absolute/path/to/dex # `which dex`
         projects:
           - id: analytics
             name: Analytics
             path: /absolute/path/to/your/project
   ```

   In the DSUI repository you can instead use the workspace package. Build its
   browser bundle first, and again after changing the UI, because `bun run dev`
   does not build it:

   ```sh
   bun run --filter @northgraindata/dsui-plugin-dex build
   ```

   ```yaml
       package: "@northgraindata/dsui-plugin-dex"
       browserBundle: "@northgraindata/dsui-plugin-dex/browser"
   ```

4. Restart DSUI, open **Dex** and select **Run now** on a project card.

| Option | Default | Meaning |
| --- | --- | --- |
| `executable` | Required | Absolute path of `dex` |
| `projects` | None | `id`, `name` and absolute `path`. Dex runs only in these directories |
| `passEnv` | None | Names of host environment variables to give Dex, such as warehouse secrets |
| `commandTimeoutMs` | 120000 | When DSUI stops a command, from 1000 to 600000 |

## Checks

**Run now** runs the full check. Use **Choose commands** to run a subset,
or choose commands when editing a schedule. Selected commands run in the
same order as a full check. Run history records the selection and marks
unselected steps as skipped. A successful subset is shown as **Partial
check**. When multiple schedules for the same project are due together, the
run combines their selected commands.


Dex has no single command that checks everything. A DSUI check runs, in order:

| Step | Commands |
| --- | --- |
| Map warehouse | `dex explore map` |
| Verify project | `dex maintain verify` |
| Check drift | `dex maintain check` |
| Update data views | `dex explore inventory`, `explore diagram`, `explore semantic list`, `transform plans` |

| Status | Meaning |
| --- | --- |
| Valid | Mapping and verification finished, and no finding is above low severity |
| Issues | At least one finding is above low severity |
| Incomplete | A required step did not finish, so DSUI cannot call the project valid |

Drift needs a baseline. Until you run `dex maintain snapshot` in the project,
ideally after a known-good build, the step is skipped and a Valid result says
that drift was not checked. DSUI does not take snapshots. Dex also reports what
it could not check; the result lists it.

Open a project to see **Run history** and **Schedules**. Add any combination of
interval schedules (1–1440 minutes after saving or the last due check) and
daily schedules at a local time. Daily schedules use the installation time
zone. When DSUI is set to use the browser time zone, the scheduler uses the
server’s time zone and shows it in the form. A local time skipped by daylight
saving is skipped for that day, and a repeated time runs once. DSUI must be
running. Due schedules for the same project are grouped into one check, and
schedules advance if that project is already running a check. Only users with
manage permission can change schedules.

DSUI keeps the last 100 runs per project and up to 500 findings per run.
Open **JSON** on a run to inspect, copy or download each Dex command response,
including command errors that returned JSON. DSUI filters connection fields
and project paths before saving. Responses over 256 KiB are listed with their
status. JSON capture applies to new runs and follows the same retention as
the run.

Checks write Dex state under `.dex/` in the project. One Dex command runs at a
time per project, and one check at a time; DSUI does not see a `dex` command that
you run in a terminal.

DSUI never adds `--confirm`, `--budget` or a spend ceiling. If Dex asks for
confirmation, the step says so. Checks were tried only with DuckDB. Check what
they cost before scheduling them on a metered warehouse.

## Security

- Dex uses the project's own warehouse credentials. DSUI service credentials are
  not shared with it.
- Dex gets `PATH`, `HOME`, locale and temporary-directory variables, plus the
  names in `passEnv`. Through `HOME` it can read credential files of the user
  that runs DSUI. DSUI turns off dbt usage reporting.
- Anyone who can view the plugin, including the AI agent and its model provider,
  can read table and column names, metrics, plans and the diagram.
- Without an authentication plugin every request acts as the owner. Set
  `DSUI_HOST=127.0.0.1` unless others should reach DSUI.
- Do not rely on Dex to ask before it writes. With DuckDB, Dex 1.19.0 ran
  `transform build --target dev` without `--confirm`.
