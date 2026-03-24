import { FlowNode } from '../types/flow';

const NODE_MARGIN = 16;
const CORNER_R = 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function nodeToRect(node: FlowNode): Rect {
  return {
    x: node.position.x - NODE_MARGIN,
    y: node.position.y - NODE_MARGIN,
    w: (node.width || 180) + NODE_MARGIN * 2,
    h: (node.height || 60) + NODE_MARGIN * 2,
  };
}

function segmentIntersectsRect(
  ax: number, ay: number, bx: number, by: number,
  rect: Rect
): boolean {
  const rx1 = rect.x, ry1 = rect.y;
  const rx2 = rect.x + rect.w, ry2 = rect.y + rect.h;

  if (ax === bx) {
    const minY = Math.min(ay, by);
    const maxY = Math.max(ay, by);
    return ax > rx1 && ax < rx2 && maxY > ry1 && minY < ry2;
  }
  if (ay === by) {
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    return ay > ry1 && ay < ry2 && maxX > rx1 && minX < rx2;
  }
  return false;
}

function pathIntersectsRect(points: [number, number][], rect: Rect): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (segmentIntersectsRect(ax, ay, bx, by, rect)) return true;
  }
  return false;
}

function corneredPath(points: [number, number][], r: number): string {
  if (points.length < 2) return '';
  const parts: string[] = [`M ${points[0][0]} ${points[0][1]}`];

  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];

    const d1 = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
    const d2 = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);
    const clampR = Math.min(r, d1 / 2, d2 / 2);

    const t1x = cx + ((px - cx) / d1) * clampR;
    const t1y = cy + ((py - cy) / d1) * clampR;
    const t2x = cx + ((nx - cx) / d2) * clampR;
    const t2y = cy + ((ny - cy) / d2) * clampR;

    parts.push(`L ${t1x} ${t1y}`);
    parts.push(`Q ${cx} ${cy} ${t2x} ${t2y}`);
  }

  const last = points[points.length - 1];
  parts.push(`L ${last[0]} ${last[1]}`);
  return parts.join(' ');
}

function midpoint(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  const mid = Math.floor((points.length - 1) / 2);
  const [ax, ay] = points[mid];
  const [bx, by] = points[mid + 1] ?? points[mid];
  return [(ax + bx) / 2, (ay + by) / 2];
}

export function buildSelfLoopPath(
  x1: number, y1: number,
  x2: number, y2: number,
  sourceNode: FlowNode | undefined
): { path: string; labelX: number; labelY: number } {
  const nodeX = sourceNode?.position.x ?? x1 - 90;
  const nodeW = sourceNode?.width ?? 180;
  const nodeH = sourceNode?.height ?? 60;
  const nodeY = sourceNode?.position.y ?? y1 - 30;

  const LOOP_GAP = 28;
  const rightX = nodeX + nodeW + LOOP_GAP;
  const leftX = nodeX - LOOP_GAP;

  const nodeTop = nodeY - NODE_MARGIN;
  const nodeBot = nodeY + nodeH + NODE_MARGIN;

  const loopAbove = y2 < y1;

  if (loopAbove) {
    const loopY = nodeTop - LOOP_GAP;
    const pts: [number, number][] = [
      [x1, y1],
      [rightX, y1],
      [rightX, loopY],
      [leftX, loopY],
      [leftX, y2],
      [x2, y2],
    ];
    return {
      path: corneredPath(pts, CORNER_R),
      labelX: (rightX + leftX) / 2,
      labelY: loopY - 10,
    };
  } else {
    const loopY = nodeBot + LOOP_GAP;
    const pts: [number, number][] = [
      [x1, y1],
      [rightX, y1],
      [rightX, loopY],
      [leftX, loopY],
      [leftX, y2],
      [x2, y2],
    ];
    return {
      path: corneredPath(pts, CORNER_R),
      labelX: (rightX + leftX) / 2,
      labelY: loopY + 10,
    };
  }
}

export function buildRoutedPath(
  x1: number, y1: number,
  x2: number, y2: number,
  nodes: FlowNode[],
  sourceId: string,
  targetId: string
): { path: string; labelX: number; labelY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;

  const obstacles = nodes
    .filter(n => n.id !== sourceId && n.id !== targetId)
    .map(nodeToRect);

  const midX = x1 + dx / 2;

  if (Math.abs(dy) < 2) {
    const pts: [number, number][] = [[x1, y1], [x2, y2]];
    return { path: corneredPath(pts, CORNER_R), labelX: midX, labelY: y1 - 10 };
  }

  if (dx > CORNER_R * 2) {
    const pts: [number, number][] = [
      [x1, y1],
      [midX, y1],
      [midX, y2],
      [x2, y2],
    ];

    const blocked = obstacles.some(rect => pathIntersectsRect(pts, rect));

    if (!blocked) {
      const [lx, ly] = midpoint(pts);
      return { path: corneredPath(pts, CORNER_R), labelX: lx, labelY: ly };
    }

    const detourX = findDetourX(x1, y1, x2, y2, midX, obstacles);
    const detoured: [number, number][] = [
      [x1, y1],
      [detourX, y1],
      [detourX, y2],
      [x2, y2],
    ];
    const [lx, ly] = midpoint(detoured);
    return { path: corneredPath(detoured, CORNER_R), labelX: lx, labelY: ly };
  }

  const backX = findBackRouteX(x1, y1, x2, y2, obstacles);
  const pts: [number, number][] = [
    [x1, y1],
    [backX, y1],
    [backX, y2],
    [x2, y2],
  ];
  const [lx, ly] = midpoint(pts);
  return { path: corneredPath(pts, CORNER_R), labelX: lx, labelY: ly };
}

function findDetourX(
  x1: number, y1: number,
  x2: number, y2: number,
  preferredMidX: number,
  obstacles: Rect[]
): number {
  const candidates: number[] = [preferredMidX];

  for (const rect of obstacles) {
    candidates.push(rect.x - NODE_MARGIN - 4);
    candidates.push(rect.x + rect.w + NODE_MARGIN + 4);
  }

  candidates.sort((a, b) => Math.abs(a - preferredMidX) - Math.abs(b - preferredMidX));

  for (const cx of candidates) {
    const pts: [number, number][] = [
      [x1, y1],
      [cx, y1],
      [cx, y2],
      [x2, y2],
    ];
    if (!obstacles.some(r => pathIntersectsRect(pts, r))) {
      return cx;
    }
  }

  return preferredMidX + 60;
}

function findBackRouteX(
  x1: number, y1: number,
  x2: number, y2: number,
  obstacles: Rect[]
): number {
  const candidates: number[] = [x1 + 24];

  for (const rect of obstacles) {
    candidates.push(rect.x - NODE_MARGIN - 4);
    candidates.push(rect.x + rect.w + NODE_MARGIN + 4);
  }

  const preferred = x1 + 24;
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));

  for (const cx of candidates) {
    const pts: [number, number][] = [
      [x1, y1],
      [cx, y1],
      [cx, y2],
      [x2, y2],
    ];
    if (!obstacles.some(r => pathIntersectsRect(pts, r))) {
      return cx;
    }
  }

  return preferred;
}
