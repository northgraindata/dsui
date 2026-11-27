import { z } from "zod";

/**
 * The one JSON object every `dex` command prints.
 *
 * Only `status` is required: a missing or unknown status must fail rather than
 * read as success. `connection` is deliberately not declared, so parsing drops
 * it before anything can store or return it.
 */
const envelopeSchema = z.object({
  status: z.enum(["ok", "not_implemented", "error", "needs_confirmation"]),
  data: z.unknown(),
  cost: z.unknown(),
  diffs: z.unknown(),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  reason: z.string().nullable().default(null),
});

export type DexEnvelope = z.output<typeof envelopeSchema>;

export class DexOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DexOutputError";
  }
}

export function parseEnvelope(stdout: string): DexEnvelope {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new DexOutputError("Dex did not print a JSON result");
  }
  const result = envelopeSchema.safeParse(json);
  if (!result.success)
    throw new DexOutputError("Dex printed a result DSUI does not recognize");
  return result.data;
}
