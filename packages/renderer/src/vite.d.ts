interface ImportMeta {
  glob<T = Record<string, unknown>>(
    pattern: string,
    options?: { eager?: boolean },
  ): Record<string, T>;
}
