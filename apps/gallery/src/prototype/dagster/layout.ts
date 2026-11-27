/*
 * Places a lineage graph left to right. Groups are ranked by what they depend
 * on and placed first; assets are then ranked inside their own group. A group's
 * box therefore never overlaps another, and a collapsed group is one card.
 */
export interface Node {
  key: string;
  group: string;
  deps: readonly string[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  width: number;
  height: number;
  groups: (Box & { name: string; open: boolean; keys: string[] })[];
  nodes: (Box & { key: string })[];
  /** Links between what is on screen: an asset, or a collapsed group. */
  edges: { from: string; to: string; fromBox: Box; toBox: Box }[];
}

export const NODE = { width: 236, height: 76 };
export const CARD = { width: 190, height: 116 };
const GAP = { column: 64, row: 14, group: 36, rank: 46 };
const PAD = { side: 16, top: 42, bottom: 16 };

/** The longest path to each item, ignoring a link that would close a loop. */
function ranks(items: readonly string[], parents: Map<string, Set<string>>) {
  const found = new Map<string, number>();
  const visiting = new Set<string>();
  const rank = (item: string): number => {
    const known = found.get(item);
    if (known !== undefined) return known;
    visiting.add(item);
    let value = 0;
    for (const parent of parents.get(item) ?? [])
      if (!visiting.has(parent)) value = Math.max(value, rank(parent) + 1);
    visiting.delete(item);
    found.set(item, value);
    return value;
  };
  for (const item of items) rank(item);
  return found;
}

/** Orders a column so that links run as level as they can. */
function byParents<T extends string>(
  column: T[],
  parents: Map<string, Set<string>>,
  middle: Map<string, number>,
) {
  const weight = (item: string) => {
    const placed = [...(parents.get(item) ?? [])]
      .map((parent) => middle.get(parent))
      .filter((value): value is number => value !== undefined);
    return placed.length
      ? placed.reduce((sum, value) => sum + value, 0) / placed.length
      : Number.MAX_SAFE_INTEGER;
  };
  return [...column].sort(
    (a, b) => weight(a) - weight(b) || a.localeCompare(b),
  );
}

const columnsOf = (items: readonly string[], rank: Map<string, number>) => {
  const columns: string[][] = [];
  for (const item of items) {
    const at = rank.get(item) ?? 0;
    columns[at] ??= [];
    columns[at].push(item);
  }
  return columns.filter(Boolean);
};

export function layout(
  nodes: readonly Node[],
  open: ReadonlySet<string>,
): Layout {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const groupNames = [...new Set(nodes.map((node) => node.group))];
  const members = new Map(
    groupNames.map((name) => [
      name,
      nodes.filter((node) => node.group === name).map((node) => node.key),
    ]),
  );
  const parents = new Map<string, Set<string>>(
    [...groupNames, ...byKey.keys()].map((item) => [item, new Set()]),
  );
  for (const node of nodes)
    for (const dep of node.deps) {
      const other = byKey.get(dep);
      if (!other) continue;
      parents.get(node.key)?.add(dep);
      if (other.group !== node.group) parents.get(node.group)?.add(other.group);
    }

  // The inside of each open group, placed from the group's own corner.
  const inner = new Map<
    string,
    { width: number; height: number; at: Map<string, [number, number]> }
  >();
  for (const name of groupNames) {
    if (!open.has(name)) continue;
    const keys = members.get(name) ?? [];
    const own = new Map(
      keys.map((key) => [
        key,
        new Set(
          [...(parents.get(key) ?? [])].filter((dep) => keys.includes(dep)),
        ),
      ]),
    );
    const columns = columnsOf(keys, ranks(keys, own));
    const middle = new Map<string, number>();
    const tallest = Math.max(...columns.map((column) => column.length));
    const height = tallest * (NODE.height + GAP.row) - GAP.row;
    const at = new Map<string, [number, number]>();
    columns.forEach((column, index) => {
      const ordered = byParents(column, own, middle);
      const top =
        (height - (ordered.length * (NODE.height + GAP.row) - GAP.row)) / 2;
      ordered.forEach((key, row) => {
        const y = top + row * (NODE.height + GAP.row);
        middle.set(key, y);
        at.set(key, [
          PAD.side + index * (NODE.width + GAP.column),
          PAD.top + y,
        ]);
      });
    });
    inner.set(name, {
      width:
        columns.length * (NODE.width + GAP.column) - GAP.column + PAD.side * 2,
      height: height + PAD.top + PAD.bottom,
      at,
    });
  }

  const size = (name: string) => inner.get(name) ?? CARD;
  const columns = columnsOf(groupNames, ranks(groupNames, parents));
  const heights = columns.map(
    (column) =>
      column.reduce((sum, name) => sum + size(name).height + GAP.group, 0) -
      GAP.group,
  );
  const height = Math.max(0, ...heights);
  const made: Layout = { width: 0, height, groups: [], nodes: [], edges: [] };
  const boxes = new Map<string, Box>();
  const middle = new Map<string, number>();
  let x = 0;
  columns.forEach((column, index) => {
    const ordered = byParents(column, parents, middle);
    const width = Math.max(...ordered.map((name) => size(name).width));
    let y = (height - (heights[index] ?? 0)) / 2;
    for (const name of ordered) {
      const own = size(name);
      const box = { x, y, width: own.width, height: own.height };
      const keys = members.get(name) ?? [];
      made.groups.push({ ...box, name, open: inner.has(name), keys });
      middle.set(name, y + own.height / 2);
      const placed = inner.get(name);
      if (placed)
        for (const [key, [dx, dy]] of placed.at) {
          const node = { x: x + dx, y: y + dy, ...NODE };
          made.nodes.push({ key, ...node });
          boxes.set(key, node);
        }
      else boxes.set(name, box);
      y += own.height + GAP.group;
    }
    x += width + GAP.rank;
  });
  made.width = Math.max(0, x - GAP.rank);

  const seen = new Set<string>();
  for (const node of nodes)
    for (const dep of node.deps) {
      const other = byKey.get(dep);
      if (!other) continue;
      const from = open.has(other.group) ? dep : other.group;
      const to = open.has(node.group) ? node.key : node.group;
      const id = `${from}>${to}`;
      const fromBox = boxes.get(from);
      const toBox = boxes.get(to);
      if (from === to || seen.has(id) || !fromBox || !toBox) continue;
      seen.add(id);
      made.edges.push({ from, to, fromBox, toBox });
    }
  return made;
}
