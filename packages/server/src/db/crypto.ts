import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type EncryptedValue = { ciphertext: string; iv: string; tag: string };

const MASTER_KEY_FILENAME = ".master-key";

/**
 * Returns the configured key, or creates one for a local runtime and persists
 * it next to the runtime data. Explicit environment configuration always wins.
 */
export function resolveMasterKey(
  dataDir: string,
  explicitKey: string | undefined,
): string {
  if (explicitKey !== undefined) {
    new ConnectionCipher(explicitKey);
    return explicitKey;
  }

  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, MASTER_KEY_FILENAME);

  try {
    const storedKey = readFileSync(path, "utf8").trim();
    new ConnectionCipher(storedKey);
    chmodSync(path, 0o600);
    return storedKey;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT")
      throw new Error(
        `Could not read DSUI master key at ${path}; remove it only if you are intentionally resetting local connection credentials`,
      );
  }

  const generatedKey = randomBytes(32).toString("base64");
  try {
    writeFileSync(path, `${generatedKey}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return generatedKey;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
    const storedKey = readFileSync(path, "utf8").trim();
    new ConnectionCipher(storedKey);
    chmodSync(path, 0o600);
    return storedKey;
  }
}

/** Encrypts UI-managed connection JSON with AES-256-GCM. */
export class ConnectionCipher {
  private readonly key: Buffer;

  constructor(masterKey: string) {
    let key: Buffer;
    try {
      key = Buffer.from(masterKey, "base64");
    } catch {
      throw new Error("DSUI_MASTER_KEY must be a base64-encoded 32-byte key");
    }
    if (key.length !== 32)
      throw new Error("DSUI_MASTER_KEY must be a base64-encoded 32-byte key");
    this.key = key;
  }

  encrypt(value: unknown): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt<T>(encrypted: EncryptedValue): T {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(encrypted.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
        decipher.final(),
      ]);
      return JSON.parse(plaintext.toString("utf8")) as T;
    } catch {
      throw new Error("Could not decrypt stored service connection");
    }
  }
}
