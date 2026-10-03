/**
 * In-place progress for work that takes long enough to notice.
 *
 * Adapter loading is slow enough to look like a hang: pinned and git adapters
 * are fetched and installed, and workspace ones still compile. Frames go to
 * stderr so stdout stays pipeable, and the whole thing collapses to committed
 * lines whenever a human is not watching, because escape codes in a CI log or
 * a Docker healthcheck are noise rather than feedback.
 */

import { createTheme } from "./theme";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
/** The Linux console has no braille glyphs. */
const ASCII_FRAMES = ["|", "/", "-", "\\"] as const;

/** Slow enough to read as motion rather than as a flicker. */
const FRAME_MS = 80;

/**
 * Work finishing inside this window is never animated. Workspace adapters
 * import in 6-121ms, so a spinner shown for 40ms is a glitch, not feedback.
 */
const ARM_AFTER_MS = 150;

const HIDE_CURSOR = "\u001b[?25l";
const SHOW_CURSOR = "\u001b[?25h";
const ERASE_LINE = "\r\u001b[2K";

export type StepStatus = "ok" | "failed";

export interface StepResult {
  readonly status: StepStatus;
  readonly ms: number;
  /** Display name of the thing that was checked, when it supplied one. */
  readonly name?: string;
  /** Why the step failed. Omitted for successes. */
  readonly detail?: string;
}

/**
 * One adapter's outcome: a display name when it loaded, an error otherwise.
 * A name is deliberately not a status, so a caller never has to parse text to
 * learn whether the step worked.
 */
export type Outcome =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly detail: string };

interface Common {
  readonly label: string;
  /**
   * Reports what the step is doing right now. Wired to the adapter build's
   * own phase callback, so the wait names itself instead of only moving.
   */
  onPhase?(phase: string): void;
}

/** A step that already knows how to describe its own result. */
export interface OutcomeStep<T extends Outcome> extends Common {
  run(): Promise<T>;
}

/** A step that reports a bare status. */
export interface Step extends Common {
  run(): Promise<Omit<StepResult, "ms">>;
}

export interface ProgressOptions {
  /** Overridable so tests do not depend on the ambient terminal. */
  readonly interactive?: boolean;
  readonly width?: number;
}

/**
 * Renders one step at a time. Adapters load sequentially, so a single
 * animating line is enough; concurrent work would need a per-line redraw.
 */
export class Progress {
  readonly #interactive: boolean;
  readonly #theme = createTheme("stderr");
  readonly #frames = process.env.TERM === "linux" ? ASCII_FRAMES : FRAMES;
  #width: number;
  #timer: ReturnType<typeof setInterval> | undefined;
  #frame = 0;
  #label = "";
  #phase = "";
  #drawn = false;
  #cursorHidden = false;
  #finished = false;

  constructor(options: ProgressOptions = {}) {
    this.#interactive =
      options.interactive ??
      (process.stderr.isTTY === true &&
        !process.env.CI &&
        process.env.TERM !== "dumb");
    this.#width = options.width ?? 0;
  }

  /** Widen the label column once every label is known. */
  reserve(labels: readonly string[]): void {
    this.#width = Math.max(this.#width, ...labels.map((l) => l.length));
  }

  /**
   * Runs a step behind the spinner and returns its measured result.
   *
   * `runOutcome` differs from `run` only in what the step returns: an outcome
   * is carried as-is, so callers do not have to re-derive a status from text.
   */
  runOutcome<T extends Outcome>(step: OutcomeStep<T>): Promise<StepResult> {
    return this.#execute(step, step.run);
  }

  /** Runs a step that reports a bare status rather than an outcome. */
  run(step: Step): Promise<StepResult> {
    return this.#execute(step, async () => {
      const result = await step.run();
      return result.status === "ok"
        ? ({ ok: true, name: result.name ?? step.label } satisfies Outcome)
        : ({ ok: false, detail: result.detail ?? "failed" } satisfies Outcome);
    });
  }

  async #execute(
    step: { label: string; onPhase?(phase: string): void },
    work: () => Promise<Outcome>,
  ): Promise<StepResult> {
    if (this.#finished) return withElapsed(0)(toResult(await settle(work)));
    this.#label = step.label;
    this.#phase = "";
    this.reserve([step.label]);

    const started = performance.now();
    let arm: ReturnType<typeof setTimeout> | undefined;
    if (this.#interactive) arm = setTimeout(() => this.#arm(), ARM_AFTER_MS);

    let result: StepResult;
    try {
      result = withElapsed(started)(toResult(await settle(work)));
    } finally {
      if (arm) clearTimeout(arm);
      // Stopped before committing, so the spinner can never outlive the cursor
      // it hid — including when the step threw.
      this.#stop();
    }
    this.#phase = "";
    this.#commit(step.label, result);
    return result;
  }

  /** Names what the running step is doing, if anything is animating. */
  note(phase: string): void {
    this.#phase = phase;
    if (this.#timer) this.#draw();
  }

  /** Ends reporting. Later steps run without drawing. */
  finish(): void {
    this.#stop();
    this.#finished = true;
  }

  #arm(): void {
    if (!this.#interactive || this.#timer) return;
    this.#cursorHidden = true;
    process.stderr.write(HIDE_CURSOR);
    this.#draw();
    this.#timer = setInterval(() => {
      this.#frame = (this.#frame + 1) % this.#frames.length;
      this.#draw();
    }, FRAME_MS);
  }

  #draw(): void {
    const spin = this.#theme.brand(this.#frames[this.#frame] ?? "·");
    const phase = this.#phase ? this.#theme.faint(` ${this.#phase}`) : "";
    this.#drawn = true;
    process.stderr.write(
      `${ERASE_LINE}  ${spin} ${this.#theme.muted(this.#label)}${phase}`,
    );
  }

  #commit(label: string, result: StepResult): void {
    const ok = result.status === "ok";
    const mark = ok ? this.#theme.healthy("✓") : this.#theme.danger("✗");
    const timing = this.#theme.faint(`${Math.round(result.ms)}ms`);
    const detail = result.detail ? ` ${this.#theme.faint(result.detail)}` : "";
    const line = `  ${mark} ${this.#theme.pad(label, this.#width)}  ${timing}${detail}`;
    // Erased only when a frame was actually drawn, so a fast run writes no
    // control characters at all.
    const erase = this.#drawn ? ERASE_LINE : "";
    this.#drawn = false;
    process.stderr.write(`${erase}${line}\n`);
  }

  #stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    // Only undo what #arm actually did, so an unarmed run stays byte-clean.
    if (this.#cursorHidden) {
      this.#cursorHidden = false;
      process.stderr.write(SHOW_CURSOR);
    }
  }
}

function withElapsed(started: number) {
  return (result: Omit<StepResult, "ms">): StepResult => ({
    ...result,
    ms: performance.now() - started,
  });
}

function toResult(outcome: Outcome): Omit<StepResult, "ms"> {
  return outcome.ok
    ? { status: "ok", name: outcome.name }
    : { status: "failed", detail: outcome.detail };
}

/** Turns a thrown step into a failure, so one bad adapter is not a crash. */
async function settle(work: () => Promise<Outcome>): Promise<Outcome> {
  try {
    return await work();
  } catch (error) {
    return { ok: false, detail: describe(error) };
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" && error ? error : "failed";
}
