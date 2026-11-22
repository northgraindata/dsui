import type {
  PluginSecretProvider,
  PluginSecretSuggestion,
} from "@northgraindata/dsui-plugin-sdk";

const DEFAULT_RETRY_AFTER_MS = 5 * 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_QUERY_LENGTH = 200;
const MAX_SUGGESTIONS = 50;

export type SuggestionResult =
  | { available: true; items: PluginSecretSuggestion[] }
  /** Listing is not possible, so the form falls back to a plain input. */
  | { available: false; items: [] };

export interface SecretSuggestionsOptions {
  provider(id: string): PluginSecretProvider | undefined;
  /** How long a failed listing is remembered before it is tried again. */
  retryAfterMs?: number;
  timeoutMs?: number;
  now?(): number;
}

/**
 * Suggests secrets from a provider, and remembers when it cannot.
 *
 * Listing often needs a broader permission than reading a secret, so a role
 * that may only read cannot list. The first failure is the check: it is
 * remembered for a few minutes, and the form gets a plain input without every
 * keystroke producing another denied call.
 */
export class SecretSuggestions {
  private readonly unavailableUntil = new Map<string, number>();
  private readonly retryAfterMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(private readonly options: SecretSuggestionsOptions) {
    this.retryAfterMs = options.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  async suggest(providerId: string, query: string): Promise<SuggestionResult> {
    const provider = this.options.provider(providerId);
    if (!provider)
      throw new Error(`Secret provider "${providerId}" is not installed`);
    if (!provider.search) return { available: false, items: [] };
    const until = this.unavailableUntil.get(providerId);
    if (until !== undefined && until > this.now())
      return { available: false, items: [] };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const items = await Promise.race([
        provider.search(query.slice(0, MAX_QUERY_LENGTH), {
          signal: controller.signal,
        }),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("timed out")),
          );
        }),
      ]);
      this.unavailableUntil.delete(providerId);
      return {
        available: true,
        items: items
          .filter(
            (item) => typeof item?.reference === "string" && item.reference,
          )
          .slice(0, MAX_SUGGESTIONS)
          .map(({ reference, label, description }) => ({
            reference,
            ...(label ? { label } : {}),
            ...(description ? { description } : {}),
          })),
      };
    } catch {
      this.unavailableUntil.set(providerId, this.now() + this.retryAfterMs);
      return { available: false, items: [] };
    } finally {
      clearTimeout(timer);
    }
  }
}
