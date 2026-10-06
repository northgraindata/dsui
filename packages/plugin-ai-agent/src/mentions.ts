export type MentionService = {
  id: string;
  name: string;
  adapter: string;
  handle: string;
};

/** Friendly names when unambiguous; stable IDs remain accepted as aliases. */
export function mentionServices(
  services: readonly Omit<MentionService, "handle">[],
): MentionService[] {
  const handles = services.map((service) =>
    service.name
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
  );
  const counts = new Map<string, number>();
  const ids = new Set(services.map((service) => service.id));
  for (const handle of handles)
    counts.set(handle, (counts.get(handle) ?? 0) + 1);
  return services.map((service, index) => {
    const handle = handles[index];
    return {
      ...service,
      handle:
        handle &&
        counts.get(handle) === 1 &&
        (!ids.has(handle) || handle === service.id)
          ? handle
          : service.id,
    };
  });
}

export function serviceMentions(
  text: string,
  services: readonly MentionService[],
) {
  const aliases = new Map<string, MentionService>();
  for (const service of services) {
    aliases.set(service.handle, service);
    aliases.set(service.id, service);
  }
  return Array.from(
    text.matchAll(/(^|[\s([{])@([\p{L}\p{N}][\p{L}\p{N}_.:-]*)/gu),
    (match) => {
      const handle = match[2].replace(/[.:]+$/g, "");
      const start = match.index + match[1].length;
      return {
        start,
        end: start + handle.length + 1,
        handle,
        service: aliases.get(handle),
      };
    },
  );
}
