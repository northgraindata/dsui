import { z } from "zod";

/**
 * A pointer to a credential that lives in a secret manager.
 *
 * It stands in for a string in a connection. The pointer is not secret, so it
 * is what DSUI stores; the value is read when an adapter is about to be called.
 */
export const secretReferenceSchema = z
  .object({
    $secret: z
      .object({
        provider: z.string().min(1),
        reference: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type SecretReference = z.infer<typeof secretReferenceSchema>;

export function isSecretReference(value: unknown): value is SecretReference {
  return secretReferenceSchema.safeParse(value).success;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function containsReferences(value: unknown): boolean {
  if (isSecretReference(value)) return true;
  if (Array.isArray(value)) return value.some(containsReferences);
  if (isRecord(value)) return Object.values(value).some(containsReferences);
  return false;
}

/** Replaces every reference, at any depth, with the value `resolve` returns. */
export async function resolveReferences(
  value: unknown,
  resolve: (reference: SecretReference["$secret"]) => Promise<string>,
): Promise<unknown> {
  if (isSecretReference(value)) return resolve(value.$secret);
  if (Array.isArray(value))
    return Promise.all(value.map((item) => resolveReferences(item, resolve)));
  if (isRecord(value))
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(
          async ([key, item]) =>
            [key, await resolveReferences(item, resolve)] as const,
        ),
      ),
    );
  return value;
}

/**
 * Puts the references from `raw` back into `resolved` at the paths they came
 * from.
 *
 * A connection is validated after its references are resolved, so the adapter
 * checks real values. What gets stored must be the references instead, or the
 * credential would end up in the database after all.
 */
export function restoreReferences(resolved: unknown, raw: unknown): unknown {
  if (isSecretReference(raw)) return raw;
  if (Array.isArray(raw) && Array.isArray(resolved))
    return resolved.map((item, index) => restoreReferences(item, raw[index]));
  if (isRecord(raw) && isRecord(resolved))
    return Object.fromEntries(
      Object.entries(resolved).map(([key, item]) => [
        key,
        restoreReferences(item, raw[key]),
      ]),
    );
  return resolved;
}
