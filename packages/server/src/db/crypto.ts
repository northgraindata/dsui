import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = { ciphertext: string; iv: string; tag: string };

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
