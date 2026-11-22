import { useEffect, useState } from "react";
import { type Adapter, getAdapters } from "../../api";

export function useAdapterCatalog() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A manual retry reloads the catalog.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    getAdapters()
      .then((items) => {
        if (active)
          setAdapters([...items].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load adapters. Check the server connection and try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return {
    adapters,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
