/** One graph node before layout: identity plus its incoming edges. */
export interface GraphInputNode {
  id: string;
  label: string;
  detail?: string;
  dependsOn: readonly string[];
}

/** A placed node. Coordinates are in the layout's own pixel space. */
export interface GraphLaidOutNode extends GraphInputNode {
  /** Dependency depth, 0 for nodes with no known dependencies. */
  layer: number;
  x: number;
  y: number;
}

/** A placed edge, drawn as a horizontal cubic bezier. */
export interface GraphLaidOutEdge {
  from: string;
  to: string;
  path: string;
}

export interface GraphLayout {
  nodes: GraphLaidOutNode[];
  edges: GraphLaidOutEdge[];
  width: number;
  height: number;
}

export const GRAPH_NODE_WIDTH = 208;
export const GRAPH_NODE_HEIGHT = 62;
const COLUMN_GAP = 88;
const ROW_GAP = 22;
const PADDING = 28;

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

/**
 * Places nodes into dependency layers left to right, preserving input
 * order within a layer so repeated renders stay stable.
 */
export function layoutDependencyGraph(
  input: readonly GraphInputNode[],
): GraphLayout {
  const known = new Set(input.map((node) => node.id));
  const edges = new Map<string, string[]>(
    input.map((node) => [
      node.id,
      node.dependsOn.filter(
        (parent) => known.has(parent) && parent !== node.id,
      ),
    ]),
  );
  const layers = depths(input, edges);
  const counts = new Map<number, number>();
  for (const node of input) {
    const layer = layers.get(node.id) ?? 0;
    counts.set(layer, (counts.get(layer) ?? 0) + 1);
  }
  const tallest = Math.max(...counts.values(), 0);
  const used = new Map<number, number>();
  const nodes = input.map((node) => {
    const layer = layers.get(node.id) ?? 0;
    const row = used.get(layer) ?? 0;
    used.set(layer, row + 1);
    // Short columns are centred against the tallest one, so a merge or
    // fan-out reads as one horizontal flow rather than a ragged top edge.
    const offset =
      ((tallest - (counts.get(layer) ?? 1)) * (GRAPH_NODE_HEIGHT + ROW_GAP)) /
      2;
    return {
      ...node,
      layer,
      x: PADDING + layer * (GRAPH_NODE_WIDTH + COLUMN_GAP),
      y: PADDING + offset + row * (GRAPH_NODE_HEIGHT + ROW_GAP),
    };
  });
  const placed = new Map(nodes.map((node) => [node.id, node]));
  const drawn: GraphLaidOutEdge[] = [];
  for (const node of nodes)
    for (const parentId of edges.get(node.id) ?? []) {
      const parent = placed.get(parentId);
      if (!parent) continue;
      const startX = parent.x + GRAPH_NODE_WIDTH;
      const startY = parent.y + GRAPH_NODE_HEIGHT / 2;
      const endX = node.x;
      const endY = node.y + GRAPH_NODE_HEIGHT / 2;
      const curve = Math.max((endX - startX) / 2, 18);
      drawn.push({
        from: parentId,
        to: node.id,
        path: `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
      });
    }
  return {
    nodes,
    edges: drawn,
    width:
      nodes.reduce((max, node) => Math.max(max, node.x + GRAPH_NODE_WIDTH), 0) +
      PADDING,
    height:
      nodes.reduce(
        (max, node) => Math.max(max, node.y + GRAPH_NODE_HEIGHT),
        0,
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

/** Reads one graph node from an adapter row; null when it has no id. */
export function graphNodeFromRow(
  row: Record<string, unknown>,
  fields: {
    idField: string;
    dependsOnField: string;
    labelField?: string;
    detailField?: string;
  },
): GraphInputNode | null {
  const id = row[fields.idField];
  if (id === null || id === undefined || id === "") return null;
  const dependsOn = row[fields.dependsOnField];
  const label = fields.labelField ? row[fields.labelField] : undefined;
  const detail = fields.detailField ? row[fields.detailField] : undefined;
  return {
    id: String(id),
    label: label === null || label === undefined ? String(id) : String(label),
    ...(detail === null || detail === undefined || detail === ""
      ? {}
      : { detail: String(detail) }),
    dependsOn: Array.isArray(dependsOn)
      ? dependsOn
          .filter((value) => value !== null && value !== undefined)
          .map(String)
      : [],
  };
}
