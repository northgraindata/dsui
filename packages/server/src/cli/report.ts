/**
 * Human-readable rendering for the CLI commands.
 *
 * Every function here returns a string rather than writing, so the same report
 * can be printed, snapshotted in a test, or embedded in an error.
 */

import type { StepResult } from "./progress";
import { createTheme } from "./theme";

const theme = createTheme("stdout");

/** Indent shared by every block, so the output reads as one column. */
const INDENT = "  ";

export interface AdapterReport {
  readonly id: string;
  readonly result: StepResult;
}

export interface ReportInput {
  readonly version: string;
  readonly configPath: string;
  readonly adapters: readonly AdapterReport[];
  readonly services: number;
  /** Wall-clock duration of the whole check. */
  readonly elapsedMs: number;
}

/** A single aligned adapter row, padded so columns line up by eye. */
function row(report: AdapterReport, width: number): string {
  const { status, ms, name, detail } = report.result;
  const mark = status === "ok" ? theme.healthy("✓") : theme.danger("✗");
  const timing = theme.faint(`${Math.round(ms)}ms`);
  const text = name ?? detail ?? "";
  const label = status === "ok" ? theme.muted(text) : theme.faint(text);
  return `${INDENT}${mark} ${theme.pad(report.id, width)}  ${timing}  ${label}`;
}

function header(input: ReportInput): string[] {
  return [
    `${INDENT}${theme.bold(theme.brand("DSUI"))} ${theme.dim("doctor")}  ${theme.faint(
      `v${input.version} · ${Math.round(input.elapsedMs)}ms`,
    )}`,
    "",
    `${INDENT}${theme.faint("config")}   ${theme.muted(input.configPath)}`,
    `${INDENT}${theme.faint("runtime")}  ${theme.muted(`bun ${Bun.version}`)}`,
    `${INDENT}${theme.faint("services")} ${theme.muted(String(input.services))}`,
    "",
  ];
}

/** Counts by status, phrased the way an operator would say it. */
function summary(adapters: readonly AdapterReport[]): string[] {
  const failed = adapters.filter((a) => a.result.status === "failed");
  if (failed.length === 0) {
    const checked = ` · ${adapters.length} checked`;
    return [
      `${INDENT}${theme.healthy("all adapters loaded")}${theme.dim(checked)}`,
    ];
  }
  const count = theme.danger(`${failed.length} unavailable`);
  const names = theme.dim(failed.map((a) => a.id).join(", "));
  return [`${INDENT}${count} ${theme.dim("·")} ${names}`];
}

export function renderDoctor(input: ReportInput): string {
  const width = Math.max(0, ...input.adapters.map((a) => a.id.length));
  const lines = [...header(input)];
  if (input.adapters.length === 0) {
    lines.push(`${INDENT}${theme.muted("no adapters configured")}`);
  } else {
    for (const report of input.adapters) lines.push(row(report, width));
  }
  lines.push("", ...summary(input.adapters), "");
  return lines.join("\n");
}

export interface ServeInput {
  /** What the user should open, which is not the bind address. */
  readonly url: string;
  readonly adapters: readonly AdapterReport[];
}

export function renderServe(input: ServeInput): string {
  const failed = input.adapters.filter((a) => a.result.status === "failed");
  const width = Math.max(0, ...input.adapters.map((a) => a.id.length));
  const lines: string[] = [""];

  if (failed.length > 0) {
    lines.push(
      `${INDENT}${theme.warning(`${failed.length} adapter unavailable`)} ${theme.dim(
        "· the workspace starts without it",
      )}`,
      "",
    );
    for (const report of failed) lines.push(row(report, width));
    lines.push("");
  }
  lines.push(
    `${INDENT}${theme.healthy("ready")}  ${theme.bold(theme.brandSoft(input.url))}`,
    `${INDENT}${theme.faint("ctrl-c to stop")}`,
    "",
  );
  return lines.join("\n");
}

interface CommandRow {
  readonly usage: string;
  readonly description: string;
}

/**
 * Help leads with the commands people actually run, because a usage block
 * without examples makes the reader guess.
 */
export function renderHelp(version: string): string {
  const rows: CommandRow[] = [
    { usage: "dsui", description: "Start the workspace on port 4192" },
    { usage: "dsui doctor", description: "Check that every adapter loads" },
    { usage: "dsui doctor --json", description: "Report as JSON, for scripts" },
    { usage: "dsui version", description: "Print the version" },
    { usage: "dsui help", description: "Show this message" },
    { usage: "dsui adapter-host", description: "Internal; not run by hand" },
  ];
  const width = Math.max(...rows.map((row) => row.usage.length));
  const lines = [
    "",
    `${INDENT}${theme.bold(theme.brand("DSUI"))} ${theme.dim(version)}`,
    `${INDENT}${theme.muted("One operational workspace for your stack.")}`,
    "",
    `${INDENT}${theme.faint("USAGE")}`,
    ...rows.map(
      (row) =>
        `${INDENT}  ${theme.muted(theme.pad(row.usage, width))}  ${theme.dim(row.description)}`,
    ),
    "",
    `${INDENT}${theme.faint("ENVIRONMENT")}`,
    `${INDENT}  ${theme.muted(theme.pad("DSUI_PORT", width))}  ${theme.dim("Port to bind, default 4192")}`,
    `${INDENT}  ${theme.muted(theme.pad("DSUI_HOST", width))}  ${theme.dim("Address to bind, default 0.0.0.0")}`,
    `${INDENT}  ${theme.muted(theme.pad("DSUI_CONFIG", width))}  ${theme.dim("Path to dsui.yaml")}`,
    "",
  ];
  return lines.join("\n");
}

/** Machine-readable form of {@link renderDoctor}, for `--json`. */
export function doctorJson(input: ReportInput): string {
  return `${JSON.stringify(
    {
      version: input.version,
      config: input.configPath,
      services: input.services,
      ok: input.adapters.every((a) => a.result.status === "ok"),
      adapters: input.adapters.map((a) => ({
        id: a.id,
        status: a.result.status,
        durationMs: Math.round(a.result.ms),
        ...(a.result.name ? { name: a.result.name } : {}),
        ...(a.result.detail ? { detail: a.result.detail } : {}),
      })),
    },
    null,
    2,
  )}\n`;
}
