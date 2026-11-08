import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "dsa";

export interface IssuedToken {
  /** Shown to the user once. */
  token: string;
  tokenHash: string;
}

/** Tokens look like `dsa_<connectorId>.<secret>`; only the secret's hash is stored. */
export function issueToken(connectorId: string): IssuedToken {
  const secret = randomBytes(32).toString("base64url");
  return {
    token: `${PREFIX}_${connectorId}.${secret}`,
    tokenHash: hashSecret(secret),
  };
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function parseToken(
  token: string,
): { connectorId: string; secret: string } | null {
  const match = /^dsa_([A-Za-z0-9-]{8,64})\.([A-Za-z0-9_-]{20,128})$/.exec(
    token,
  );
  return match
    ? { connectorId: match[1] as string, secret: match[2] as string }
    : null;
}

export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
