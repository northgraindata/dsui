/*
 * A part of Dagster's asset selection syntax: names, `group:`, `kind:`,
 * `owner:` and `code_location:`, with `+` before or after a term for
 * everything upstream or downstream of it. Terms joined by a space or `or`
 * add up.
 */
import { type AssetDef, assets, reach } from "./graph";

const fields: Partial<
  Record<string, (asset: AssetDef, value: string) => boolean>
> = {
  group: (asset, value) => asset.group === value,
  kind: (asset, value) => asset.kinds.includes(value),
  owner: (asset, value) => asset.owner === value,
  code_location: (asset, value) => asset.location === value,
  key: (asset, value) => asset.key === value || asset.name === value,
};

function matches(term: string): string[] {
  const colon = term.indexOf(":");
  const field = colon > 0 ? term.slice(0, colon) : "";
  const test = fields[field];
  const value = test ? term.slice(colon + 1).replaceAll('"', "") : term;
  // A bare word matches names that contain it; `*` stands for any text.
  const pattern = value.includes("*")
    ? new RegExp(`^${value.split("*").map(escaped).join(".*")}$`)
    : undefined;
  return assets
    .filter((asset) => {
      if (pattern && (!test || field === "key"))
        return pattern.test(asset.name);
      return test ? test(asset, value) : asset.name.includes(value);
    })
    .map((asset) => asset.key);
}

const escaped = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

/** The selected keys, or `undefined` when nothing is being selected. */
export function selectAssets(query: string): Set<string> | undefined {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && term !== "or");
  if (!terms.length) return undefined;
  const found = new Set<string>();
  for (const term of terms) {
    const up = term.startsWith("+");
    const down = term.endsWith("+");
    const base = term.slice(up ? 1 : 0, down ? -1 : undefined);
    if (!base) continue;
    const keys = matches(base);
    for (const key of keys) found.add(key);
    if (up) for (const key of reach(keys, "up")) found.add(key);
    if (down) for (const key of reach(keys, "down")) found.add(key);
  }
  return found;
}
