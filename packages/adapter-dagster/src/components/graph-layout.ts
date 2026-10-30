/** One graph node before layout: identity, group, and incoming edges. */
export interface GraphInputNode {
  id: string;
  dependsOn: readonly string[];
  /** Nodes sharing a group are drawn inside one labelled frame. */
  group?: string;
}

export type GraphLaidOutNode<T extends GraphInputNode = GraphInputNode> = T & {
  /** Dependency depth, 0 for nodes with no known dependencies. */
  layer: number;
  x: number;
  y: number;
};

/** A placed edge, drawn as a horizontal cubic bezier. */
export interface GraphLaidOutEdge {
  from: string;
  to: string;
  path: string;
}

export interface GraphFrame {
  group: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphLayout<T extends GraphInputNode = GraphInputNode> {
  nodes: GraphLaidOutNode<T>[];
  edges: GraphLaidOutEdge[];
  frames: GraphFrame[];
  width: number;
  height: number;
}

export const GRAPH_NODE_WIDTH = 252;
export const GRAPH_NODE_HEIGHT = 88;
const COLUMN_GAP = 108;
const ROW_GAP = 28;
const PADDING = 40;
const FRAME_PAD_X = 28;
const FRAME_PAD_BOTTOM = 28;
const FRAME_HEADER = 48;
const FRAME_GAP = 40;

const COLUMN_STEP = GRAPH_NODE_WIDTH + COLUMN_GAP;
const ROW_STEP = GRAPH_NODE_HEIGHT + ROW_GAP;

/**
 * Longest-path depth per node. Edges that close a cycle are ignored so
 * a malformed dependency set still lays out instead of hanging.
 */
function depths(
  nodes: readonly GraphInputNode[],
  edges: Map<string, string[]>,
): Map<string, number> {
  const resolved = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const cached = resolved.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let depth = 0;
    for (const parent of edges.get(id) ?? [])
      depth = Math.max(depth, depthOf(parent) + 1);
    visiting.delete(id);
    resolved.set(id, depth);
    return depth;
  };
  for (const node of nodes) depthOf(node.id);
  return resolved;
}

interface Band {
  group: string;
  first: number;
  last: number;
  rows: number;
  top: number;
  height: number;
}

/**
 * Stacks each group into its own horizontal band, sharing rows with
 * groups whose columns do not overlap, so frames can never intersect.
 */
function placeBands(bands: Band[], framed: boolean) {
  const placed: Band[] = [];
  const ordered = [...bands].sort(
    (a, b) => a.first - b.first || a.group.localeCompare(b.group),
  );
  for (const band of ordered) {
    const clashes = placed.filter(
      (other) => other.first <= band.last && band.first <= other.last,
    );
    const candidates = [
      PADDING,
      ...clashes.map(
        (other) => other.top + other.height + (framed ? FRAME_GAP : ROW_GAP),
      ),
    ].sort((a, b) => a - b);
    band.top =
      candidates.find((top) =>
        clashes.every(
          (other) =>
            top >= other.top + other.height + (framed ? FRAME_GAP : ROW_GAP) ||
            top + band.height + (framed ? FRAME_GAP : ROW_GAP) <= other.top,
        ),
      ) ?? PADDING;
    placed.push(band);
  }
}

/**
 * Places nodes into dependency columns left to right. Grouped graphs get
 * one framed band per group; within a column, nodes follow the average
 * height of their parents so edges cross as little as practical.
 */
export function layoutGraph<T extends GraphInputNode>(
  input: readonly T[],
): GraphLayout<T> {
  const known = new Set(input.map((node) => node.id));
  const edges = new Map<string, string[]>(
    input.map((node) => [
      node.id,
      [...new Set(node.dependsOn)].filter(
        (parent) => known.has(parent) && parent !== node.id,
      ),
    ]),
  );
  const layers = depths(input, edges);
  const framed = input.some((node) => node.group);
  const groupOf = (node: T) => node.group ?? "";
  const frameX = framed ? FRAME_PAD_X : 0;

  const cells = new Map<string, Map<number, T[]>>();
  for (const node of input) {
    const group = groupOf(node);
    const columns = cells.get(group) ?? new Map<number, T[]>();
    const layer = layers.get(node.id) ?? 0;
    columns.set(layer, [...(columns.get(layer) ?? []), node]);
    cells.set(group, columns);
  }

  const bands = [...cells].map(([group, columns]) => {
    const keys = [...columns.keys()];
    const rows = Math.max(...[...columns.values()].map((list) => list.length));
    const content = rows * ROW_STEP - ROW_GAP;
    return {
      group,
      first: Math.min(...keys),
      last: Math.max(...keys),
      rows,
      top: 0,
      height: framed ? FRAME_HEADER + content + FRAME_PAD_BOTTOM : content,
    };
  });
  placeBands(bands, framed);
  const bandOf = new Map(bands.map((band) => [band.group, band]));

  const centres = new Map<string, number>();
  const placed = new Map<string, GraphLaidOutNode<T>>();
  const lastLayer = Math.max(0, ...layers.values());
  for (let layer = 0; layer <= lastLayer; layer++) {
    for (const [group, columns] of cells) {
      const column = columns.get(layer);
      const band = bandOf.get(group);
      if (!column || !band) continue;
      const weight = (node: T) => {
        const parents = (edges.get(node.id) ?? []).flatMap((id) => {
          const centre = centres.get(id);
          return centre === undefined ? [] : [centre];
        });
        return parents.length
          ? parents.reduce((sum, value) => sum + value, 0) / parents.length
          : Number.NEGATIVE_INFINITY;
      };
      const ordered = column
        .map((node, index) => ({ node, index, weight: weight(node) }))
        .sort((a, b) => a.weight - b.weight || a.index - b.index);
      // Short columns are centred against the band's tallest one, so a
      // merge or fan-out reads as one flow rather than a ragged top edge.
      const offset = ((band.rows - ordered.length) * ROW_STEP) / 2;
      const top = band.top + (framed ? FRAME_HEADER : 0) + offset;
      ordered.forEach(({ node }, row) => {
        const y = top + row * ROW_STEP;
        centres.set(node.id, y + GRAPH_NODE_HEIGHT / 2);
        placed.set(node.id, {
          ...node,
          layer,
          x: PADDING + frameX + layer * COLUMN_STEP,
          y,
        });
      });
    }
  }
  const nodes = input.flatMap((node) => {
    const laidOut = placed.get(node.id);
    return laidOut ? [laidOut] : [];
  });

  const drawn: GraphLaidOutEdge[] = [];
  for (const node of nodes)
    for (const parentId of edges.get(node.id) ?? []) {
      const parent = placed.get(parentId);
      if (!parent) continue;
      const startX = parent.x + GRAPH_NODE_WIDTH;
      const startY = parent.y + GRAPH_NODE_HEIGHT / 2;
      const endX = node.x;
      const endY = node.y + GRAPH_NODE_HEIGHT / 2;
      const curve = Math.max((endX - startX) / 2, 24);
      drawn.push({
        from: parentId,
        to: node.id,
        path: `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
      });
    }

  const frames: GraphFrame[] = framed
    ? bands
        .filter((band) => band.group)
        .map((band) => ({
          group: band.group,
          count: [...(cells.get(band.group)?.values() ?? [])].reduce(
            (sum, list) => sum + list.length,
            0,
          ),
          x: PADDING + band.first * COLUMN_STEP,
          y: band.top,
          width:
            (band.last - band.first) * COLUMN_STEP +
            GRAPH_NODE_WIDTH +
            FRAME_PAD_X * 2,
          height: band.height,
        }))
    : [];

  return {
    nodes,
    edges: drawn,
    frames,
    width:
      Math.max(
        0,
        ...nodes.map((node) => node.x + GRAPH_NODE_WIDTH + frameX),
        ...frames.map((frame) => frame.x + frame.width),
      ) + PADDING,
    height:
      Math.max(
        0,
        ...nodes.map((node) => node.y + GRAPH_NODE_HEIGHT),
        ...frames.map((frame) => frame.y + frame.height),
      ) + PADDING,
  };
}

export type GraphSize = { width: number; height: number };
export type GraphOffset = { x: number; y: number };

/** Board edge that must stay on screen, so a pan can never lose it. */
const MIN_VISIBLE = 96;

/**
 * Constrains a pan so part of the board always remains on the canvas,
 * while leaving movement free in both directions otherwise.
 */
export function clampOffset(
  offset: GraphOffset,
  canvas: GraphSize,
  board: GraphSize,
): GraphOffset {
  const slackX = Math.min(MIN_VISIBLE, board.width);
  const slackY = Math.min(MIN_VISIBLE, board.height);
  return {
    x: Math.min(
      Math.max(offset.x, slackX - board.width),
      canvas.width - slackX,
    ),
    y: Math.min(
      Math.max(offset.y, slackY - board.height),
      canvas.height - slackY,
    ),
  };
}

/** Centres a board that fits the canvas; anchors a larger one at its roots. */
export function restingOffset(
  canvas: GraphSize,
  board: GraphSize,
): GraphOffset {
  return {
    x: board.width <= canvas.width ? (canvas.width - board.width) / 2 : 0,
    y: board.height <= canvas.height ? (canvas.height - board.height) / 2 : 0,
  };
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 1.75;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Zoom that shows the whole board with a margin, never above 100%. */
export function fitZoom(canvas: GraphSize, layout: GraphSize): number {
  if (!layout.width || !layout.height) return 1;
  return clampZoom(
    Math.min(
      1,
      (canvas.width * 0.94) / layout.width,
      (canvas.height * 0.94) / layout.height,
    ),
  );
}

/**
 * Offset that keeps the board point under `anchor` fixed while the zoom
 * changes, so zooming follows the cursor instead of the board's corner.
 */
export function zoomAround(
  offset: GraphOffset,
  anchor: GraphOffset,
  from: number,
  to: number,
): GraphOffset {
  const ratio = to / from;
  return {
    x: anchor.x - (anchor.x - offset.x) * ratio,
    y: anchor.y - (anchor.y - offset.y) * ratio,
  };
}
