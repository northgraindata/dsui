import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { S3Context } from "./context.js";

/**
 * Classifies an S3 error into what it means for health.
 *
 * The distinction matters more here than for a database: a rejected
 * credential and an unreachable endpoint produce the same failure to
 * `listBuckets`, yet only one of them is a service problem. Reporting an
 * invalid key as "storage is down" would send an operator to the wrong
 * system.
 */
function classify(error: unknown): {
  health: "unavailable" | "unknown";
  reason: string;
} {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  const message = error instanceof Error ? error.message : "S3 request failed";
  if (
    name === "AccessDenied" ||
    name === "InvalidAccessKeyId" ||
    name === "SignatureDoesNotMatch" ||
    /\b403\b/.test(message)
  )
    return { health: "unknown", reason: `Credentials rejected: ${message}` };
  if (name === "NoSuchBucket" || name === "NotFound" || /\b404\b/.test(message))
    return { health: "unknown", reason: `Endpoint not found: ${message}` };
  if (name === "SlowDown" || name === "ServiceUnavailable")
    return { health: "unavailable", reason: `Endpoint throttling: ${message}` };
  return { health: "unavailable", reason: message };
}

/**
 * Reports the health of an S3-compatible endpoint.
 *
 * Bucket enumeration doubles as the reachability and authorization probe: it
 * is the cheapest call that exercises both the endpoint and the credentials,
 * so no extra request is made purely for health.
 */
export async function s3Health(ctx: S3Context) {
  const started = Date.now();
  try {
    const buckets = await ctx.client.listBuckets();
    return healthReport({
      checks: [
        reachabilityCheck(true, Date.now() - started),
        {
          id: "listing",
          label: "Bucket listing",
          ok: true,
          detail: `${buckets.length} bucket${buckets.length === 1 ? "" : "s"} visible`,
        },
      ],
      weights: { reachability: 1, listing: 0 },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    const { health, reason } = classify(error);
    return healthReport({
      checks: [
        {
          id: "reachability",
          label: "Service reachable",
          ok: false,
          detail: reason,
        },
      ],
      weights: { reachability: 1 },
      // A rejected credential is a configuration fault, not evidence that the
      // endpoint is down, so the status stays `unknown`.
      status: health,
    });
  }
}
