import { InvalidDefinitionError } from "../shared/errors";
import type { AdapterHealthCheck, AdapterHealthReport } from "./types";

/**
 * Health scoring helpers for adapter authors.
 *
 * The score is derived from the adapter's own signals rather than assigned by
 * the host, because only the adapter knows what a healthy value looks like for
 * the system it integrates with. These helpers keep that computation honest
 * and consistent without hardcoding a single threshold for every service.
 */

/** Weight applied to a failing signal, as a fraction of the total score. */
export interface SignalWeight {
  /**
   * Penalty applied when the signal is not `ok`, between 0 and 1.
   *
   * A signal that should condemn the service outright uses `1`; a signal
   * that merely degrades it uses a smaller fraction, such as `0.25` for a
   * disk that is 85% full.
   */
  readonly penalty: number;
}

/**
 * Scores a set of signals as 100 minus the sum of failing penalties.
 *
 * A service whose signals are all `ok` scores 100. Signals omitted from
 * `weights` do not affect the score, so an adapter can report a check for
 * display without letting it move the number.
 *
 * @throws {@link InvalidDefinitionError} when a penalty is outside 0..1, which
 * would silently produce a score outside 0..100.
 */
export function scoreChecks(
  checks: readonly AdapterHealthCheck[],
  weights: Readonly<Record<string, SignalWeight | number>>,
): number {
  let score = 100;
  for (const check of checks) {
    if (check.ok) continue;
    const weight = weights[check.id];
    if (weight === undefined) continue;
    const penalty = typeof weight === "number" ? weight : weight.penalty;
    if (penalty < 0 || penalty > 1)
      throw new InvalidDefinitionError(
        `Health signal "${check.id}" has a penalty of ${penalty}; expected 0..1`,
      );
    score -= penalty * 100;
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Derives the status that matches a score.
 *
 * `unavailable` is never inferred from a number: only an adapter that knows
 * the service is unusable can say so. A zero score with all signals healthy
 * is contradictory, so it is reported as `unknown` rather than guessed.
 */
export function statusFor(
  score: number,
  checks: readonly AdapterHealthCheck[],
): AdapterHealthReport["status"] {
  if (checks.some((check) => !check.ok) && score === 0) return "unavailable";
  if (score >= 100) return "healthy";
  // Below the healthy band, a status is only meaningful when a signal
  // explains it. A low score with nothing failing is reported as unknown
  // rather than guessed at.
  if (score >= 60 && checks.some((check) => !check.ok)) return "warning";
  return checks.some((check) => !check.ok) ? "warning" : "unknown";
}

/** Convenience signal for a successful or failed round trip. */
export function reachabilityCheck(
  reachable: boolean,
  latencyMs?: number,
): AdapterHealthCheck {
  return {
    id: "reachability",
    label: "Service reachable",
    ok: reachable,
    ...(latencyMs !== undefined
      ? { detail: `${latencyMs} ms response time` }
      : {}),
  };
}

/** Builds a complete report from signals and their weights. */
export function healthReport(input: {
  checks: readonly AdapterHealthCheck[];
  weights: Readonly<Record<string, SignalWeight | number>>;
  latencyMs?: number;
  status?: AdapterHealthReport["status"];
}): AdapterHealthReport {
  const score = scoreChecks(input.checks, input.weights);
  return {
    status: input.status ?? statusFor(score, input.checks),
    score,
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    checks: input.checks,
  };
}
