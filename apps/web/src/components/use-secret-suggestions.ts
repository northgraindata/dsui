import type { SuggestOption } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import { getSecretSuggestions, type SecretProvider } from "../api";

const DEBOUNCE_MS = 200;
// Matches how long the server remembers a manager that cannot list, so a form
// does not ask again on every field it opens.
const RETRY_AFTER_MS = 5 * 60_000;
const unavailableUntil = new Map<string, number>();

const none = { options: [] as SuggestOption[], loading: false };

/**
 * Secrets to offer for a reference being typed, once the field has asked.
 *
 * Only the part before `#` is a secret's name; after it a person is choosing a
 * field, which there is nothing to suggest for. A manager that reports it
 * cannot list is not asked again for a few minutes.
 */
export function useSecretSuggestions(
  provider: SecretProvider | undefined,
  text: string,
) {
  const [asked, setAsked] = useState(false);
  const [state, setState] = useState(none);
  const providerId = provider?.id;
  const searchable = provider?.searchable === true;
  const choosingField = text.includes("#");
  const name = text.split("#")[0].trim();

  useEffect(() => {
    const retryAt = providerId ? unavailableUntil.get(providerId) : undefined;
    if (
      !asked ||
      !searchable ||
      !providerId ||
      choosingField ||
      (retryAt !== undefined && retryAt > Date.now())
    ) {
      setState(none);
      return;
    }
    let current = true;
    setState((previous) => ({ ...previous, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const result = await getSecretSuggestions(providerId, name);
        if (!current) return;
        if (!result.available) {
          unavailableUntil.set(providerId, Date.now() + RETRY_AFTER_MS);
          setState(none);
          return;
        }
        setState({
          loading: false,
          options: result.items.map((item) => ({
            value: item.reference,
            ...(item.label ? { label: item.label } : {}),
            ...(item.description ? { description: item.description } : {}),
          })),
        });
      } catch {
        // A failed request is not proof the manager cannot list: try again later.
        if (current) setState(none);
      }
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [asked, searchable, providerId, name, choosingField]);

  return { ...state, suggest: () => setAsked(true) };
}
