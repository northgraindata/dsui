import type { PluginSecretProvider } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  containsReferences,
  resolveReferences,
  type SecretReference,
} from "./reference";

const connectionSchema = z.record(z.unknown());
const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export class SecretResolutionError extends Error {}

export interface SecretResolverOptions {
  /** Looks a provider up by id at call time, so plugin reloads are seen. */
  provider(id: string): PluginSecretProvider | undefined;
  ttlMs?: number;
  timeoutMs?: number;
  now?(): number;
}

/**
 * Reads credentials from secret providers on demand.
 *
 * Values are held in memory only, briefly: the secret manager is the source of
 * truth, and a short lifetime is what lets a rotation take effect. Errors name
 * the provider and reference but never carry a value.
 */
export class SecretResolver {
  private readonly cache = new Map<
    string,
    { value: string; expiresAt: number }
  >();
  private readonly pending = new Map<string, Promise<string>>();
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(private readonly options: SecretResolverOptions) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  /** Resolves every reference in a connection; one without any is returned as is. */
  async resolveConnection(
    connection: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!containsReferences(connection)) return connection;
    return connectionSchema.parse(
      await resolveReferences(connection, (reference) =>
        this.resolve(reference),
      ),
    );
  }

  resolve({
    provider,
    reference,
  }: SecretReference["$secret"]): Promise<string> {
    const key = JSON.stringify([provider, reference]);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now())
      return Promise.resolve(cached.value);
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const request = this.fetch(provider, reference)
      .then((value) => {
        this.cache.set(key, { value, expiresAt: this.now() + this.ttlMs });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  clear(): void {
    this.cache.clear();
  }

  private async fetch(providerId: string, reference: string): Promise<string> {
    const provider = this.options.provider(providerId);
    if (!provider)
      throw new SecretResolutionError(
        `Secret provider "${providerId}" is not installed`,
      );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const value = await Promise.race([
        provider.resolve(reference, { signal: controller.signal }),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("timed out")),
          );
        }),
      ]);
      if (typeof value !== "string")
        throw new Error("the provider did not return a string");
      return value;
    } catch (error) {
      throw new SecretResolutionError(
        `Could not read "${reference}" from ${provider.label}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
