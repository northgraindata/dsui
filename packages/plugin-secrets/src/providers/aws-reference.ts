export interface AwsSecretReference {
  /** A secret's name or full ARN. */
  secretId: string;
  /** A key inside a JSON secret; absent when the secret is the value itself. */
  key?: string;
}

/**
 * Reads `<name or ARN>` or `<name or ARN>#<json key>`.
 *
 * `#` is not a legal character in a secret name or an ARN, so the first one
 * always starts the key.
 */
export function parseReference(reference: string): AwsSecretReference {
  const separator = reference.indexOf("#");
  const secretId = (
    separator === -1 ? reference : reference.slice(0, separator)
  ).trim();
  const key = separator === -1 ? undefined : reference.slice(separator + 1);
  if (!secretId) throw new Error("the secret name is empty");
  if (key !== undefined && key.length === 0)
    throw new Error('the key after "#" is empty');
  return key === undefined ? { secretId } : { secretId, key };
}
