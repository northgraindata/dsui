/** Declarative nodes have no required ID; distinguish identical siblings by occurrence. */
export function keyedItems<T>(items: readonly T[]): { item: T; key: string }[] {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const identity = JSON.stringify(
      item !== null &&
        typeof item === "object" &&
        "id" in item &&
        (typeof item.id === "string" || typeof item.id === "number")
        ? { id: item.id }
        : item,
    );
    if (identity === undefined)
      throw new Error("Rendered items must be serializable");
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { item, key: JSON.stringify([identity, occurrence]) };
  });
}
