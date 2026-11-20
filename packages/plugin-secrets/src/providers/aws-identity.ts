import { fromWebToken } from "@aws-sdk/credential-providers";
import { z } from "zod";

/** Credentials from AWS, the shape the SDK's clients accept. */
export type AssumedCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
};

const ROLE_ARN = /^arn:aws[a-z-]*:iam::[0-9]{12}:role\/[\w+=,.@/-]+$/;

/**
 * Credentials that come from a token DSUI Cloud signs for this secret manager.
 *
 * The customer's AWS role trusts that token, so no AWS key is written anywhere.
 * The instance asks the panel for a token, with a secret only it and the panel
 * hold, and exchanges the token for short-lived AWS credentials.
 */
export const identitySchema = z
  .object({
    roleArn: z.string().regex(ROLE_ARN, "must be the ARN of an IAM role"),
    tokenUrl: z.string().url(),
    /** Presented to the panel as a bearer, normally `${DSUI_IDENTITY_SECRET}`. */
    token: z.string().min(1),
  })
  .strict();
export type Identity = z.infer<typeof identitySchema>;

const tokenResponseSchema = z.object({ token: z.string().min(1) });

const TOKEN_TIMEOUT_MS = 10_000;
// Credentials are replaced a little before they expire, so a request that
// starts just inside the window does not run on credentials that die midway.
const REFRESH_MARGIN_MS = 5 * 60_000;
const SESSION_NAME = "dsui";
const SESSION_SECONDS = 3600;

export interface IdentityDeps {
  /** Asks the panel for a token. Never include the bearer in an error. */
  fetchToken(identity: Identity, signal?: AbortSignal): Promise<string>;
  /** Exchanges a token for credentials of the role. */
  assume(
    roleArn: string,
    webIdentityToken: string,
    client: { region?: string; endpoint?: string },
  ): Promise<AssumedCredentials>;
  now(): number;
}

async function fetchToken(
  identity: Identity,
  signal?: AbortSignal,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(identity.tokenUrl, {
      headers: { authorization: `Bearer ${identity.token}` },
      signal: AbortSignal.any([
        AbortSignal.timeout(TOKEN_TIMEOUT_MS),
        ...(signal ? [signal] : []),
      ]),
    });
  } catch {
    throw new Error("could not reach DSUI Cloud for an identity token");
  }
  if (!response.ok)
    throw new Error(
      `DSUI Cloud refused an identity token (status ${response.status})`,
    );
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("DSUI Cloud answered an identity token request badly");
  return parsed.data.token;
}

const defaultDeps: IdentityDeps = {
  fetchToken,
  assume: async (roleArn, webIdentityToken, client) => {
    const credentials = await fromWebToken({
      roleArn,
      webIdentityToken,
      roleSessionName: SESSION_NAME,
      durationSeconds: SESSION_SECONDS,
      clientConfig: {
        ...(client.region ? { region: client.region } : {}),
        ...(client.endpoint ? { endpoint: client.endpoint } : {}),
      },
    })();
    return {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      ...(credentials.sessionToken
        ? { sessionToken: credentials.sessionToken }
        : {}),
      ...(credentials.expiration ? { expiration: credentials.expiration } : {}),
    };
  },
  now: Date.now,
};

/**
 * A credentials provider for the AWS client: fetches a token and assumes the
 * role when it has none, and again shortly before the credentials expire.
 * Concurrent requests share one exchange, and a failure is not remembered.
 */
export function identityCredentials(
  identity: Identity,
  client: { region?: string; endpoint?: string },
  deps: IdentityDeps = defaultDeps,
): () => Promise<AssumedCredentials> {
  let current: AssumedCredentials | undefined;
  let pending: Promise<AssumedCredentials> | undefined;

  const fresh = (credentials: AssumedCredentials) =>
    credentials.expiration === undefined ||
    credentials.expiration.getTime() - REFRESH_MARGIN_MS > deps.now();

  return () => {
    if (current && fresh(current)) return Promise.resolve(current);
    pending ??= (async () => {
      const token = await deps.fetchToken(identity);
      return deps.assume(identity.roleArn, token, client);
    })()
      .then((credentials) => {
        current = credentials;
        return credentials;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
