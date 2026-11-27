import { expect, test } from "bun:test";
import { assets, groups } from "./graph";
import { type Box, layout } from "./layout";

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const clean = (boxes: Box[]) =>
  boxes.every((a, i) => boxes.slice(i + 1).every((b) => !overlaps(a, b)));

for (const [name, open] of [
  ["collapsed", []],
  ["two open", ["core", "staging"]],
  ["all open", groups],
] as const)
  test(`${name}: no card or group covers another`, () => {
    const made = layout(assets, new Set(open));
    expect(clean(made.groups)).toBe(true);
    expect(clean(made.nodes)).toBe(true);
    for (const node of made.nodes) {
      const group = made.groups.find((item) => item.keys.includes(node.key));
      expect(group && overlaps(group, node)).toBe(true);
    }
  });

test("an asset sits to the right of what it depends on", () => {
  const made = layout(assets, new Set(groups));
  const at = new Map(made.nodes.map((node) => [node.key, node]));
  for (const asset of assets)
    for (const dep of asset.deps)
      expect(at.get(asset.key)?.x).toBeGreaterThan(at.get(dep)?.x ?? 0);
});
