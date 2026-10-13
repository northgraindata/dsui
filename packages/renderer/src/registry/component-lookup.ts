/** Keep adapter-local browser paths scoped to the declaring adapter. */
export function lookupComponent<T>(
  components: ReadonlyMap<string, T>,
  id: string,
  path?: string,
): T | null {
  const direct = components.get(id);
  if (direct) return direct;
  if (id.includes("/"))
    return components.get(`${id.split("/")[0]}:${path ?? ""}`) ?? null;
  return components.get(path ?? "") ?? null;
}
