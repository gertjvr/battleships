import { FLEET_SIZES, ShipSize, Orientation, canPlace, placeShip, inBounds, type Coord, type Player as PlayerEngine, type ShotResult } from '@app/engine';
import type { Difficulty } from './persistence';

// Random helpers kept local to web (UI) layer
function randInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomCoord(): Coord {
  return { r: randInt(10), c: randInt(10) };
}

function randomOrientation(): Orientation {
  return Math.random() < 0.5 ? 'H' : 'V';
}

export function randomPlaceFleet(): PlayerEngine['fleet'] {
  let fleet: PlayerEngine['fleet'] = [];
  for (const size of FLEET_SIZES as ShipSize[]) {
    // Try positions until we can place.
    let placed = false;
    for (let attempts = 0; attempts < 1000 && !placed; attempts++) {
      const start = randomCoord();
      const orientation = randomOrientation();
      if (canPlace(fleet, start, size, orientation)) {
        fleet = placeShip(fleet, start, size, orientation);
        placed = true;
      }
    }
    if (!placed) {
      // Fallback: restart simple generator (very unlikely on 10x10)
      return randomPlaceFleet();
    }
  }
  return fleet;
}

export function randomNextShot(shots: Set<string>): Coord {
  // Build list of remaining cells
  const remaining: Coord[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const k = `${r},${c}`;
      if (!shots.has(k)) remaining.push({ r, c });
    }
  }
  if (remaining.length === 0) return { r: 0, c: 0 };
  return remaining[randInt(remaining.length)];
}

export type AIMemory = {
  targetQueue: string[]; // coord keys to try next
  cluster: string[]; // known hit cells for the current (unsunk) ship
  parity: 0 | 1; // for hunt parity
  sizesLeft: number[]; // remaining ship sizes to find
};

export function emptyAIMemory(): AIMemory {
  return { targetQueue: [], cluster: [], parity: (randInt(2) as 0 | 1), sizesLeft: [...FLEET_SIZES] };
}

function keyOf(c: Coord): string { return `${c.r},${c.c}`; }
function fromKey(k: string): Coord { const [r, c] = k.split(',').map(Number); return { r, c }; }

function shuffled<T>(arr: T[]): T[] { return arr.sort(() => Math.random() - 0.5); }

function nextHuntParity(shots: Set<string>, parity: 0 | 1): Coord | null {
  // Prefer cells with (r+c)%2 === parity
  const cand: Coord[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (((r + c) & 1) !== parity) continue;
      const k = `${r},${c}`;
      if (!shots.has(k)) cand.push({ r, c });
    }
  }
  if (cand.length === 0) return null;
  return cand[randInt(cand.length)];
}

function neighbors(c: Coord): Coord[] {
  return [
    { r: c.r - 1, c: c.c },
    { r: c.r + 1, c: c.c },
    { r: c.r, c: c.c - 1 },
    { r: c.r, c: c.c + 1 },
  ].filter(inBounds);
}

// Derive next best target cells from the current hit cluster for hard mode.
function targetsFromCluster(shots: Set<string>, cluster: string[], sizesLeft?: number[]): string[] {
  if (cluster.length === 0) return [];
  const coords = cluster.map(fromKey);
  if (coords.length === 1) {
    // try immediate neighbors of the single hit
    return neighbors(coords[0]).filter((c) => !shots.has(keyOf(c))).map(keyOf);
  }
  const sameRow = coords.every((c) => c.r === coords[0].r);
  const sameCol = coords.every((c) => c.c === coords[0].c);
  if (!(sameRow || sameCol)) {
    // If we don't have a straight line for some reason, fall back to neighbors of last
    const last = coords[coords.length - 1];
    return neighbors(last).filter((c) => !shots.has(keyOf(c))).map(keyOf);
  }
  // Extend the line at both ends until an unshot cell is found
  const sorted = coords.sort((a, b) => (sameRow ? a.c - b.c : a.r - b.r));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const ext1 = sameRow ? { r: first.r, c: first.c - 1 } : { r: first.r - 1, c: first.c };
  const ext2 = sameRow ? { r: last.r, c: last.c + 1 } : { r: last.r + 1, c: last.c };
  const candidates: Coord[] = [];
  if (inBounds(ext1) && !shots.has(keyOf(ext1))) candidates.push(ext1);
  if (inBounds(ext2) && !shots.has(keyOf(ext2))) candidates.push(ext2);
  if (!sizesLeft || sizesLeft.length === 0) return candidates.map(keyOf);
  const minEligible = Math.min(...sizesLeft.filter((s) => s >= coords.length));
  if (!isFinite(minEligible)) return candidates.map(keyOf);
  function openRun(from: Coord, dr: number, dc: number): number {
    let r = from.r, c = from.c, len = 0;
    while (true) {
      const nr = r + dr, nc = c + dc;
      const k = `${nr},${nc}`;
      if (!inBounds({ r: nr, c: nc })) break;
      if (shots.has(k)) break; // already shot -> blocked
      len++;
      r = nr; c = nc;
    }
    return len;
  }
  const out: string[] = [];
  for (const cand of candidates) {
    const dir = sameRow ? { dr: 0, dc: cand.c < first.c ? -1 : 1 } : { dr: cand.r < first.r ? -1 : 1, dc: 0 };
    const run = openRun(cand, dir.dr, dir.dc);
    const feasible = sizesLeft.some((s) => s >= coords.length && (s - coords.length) <= (1 + run));
    if (feasible) out.push(keyOf(cand));
  }
  return out.length > 0 ? out : candidates.map(keyOf);
}

export function chooseNextShot(shots: Set<string>, mem: AIMemory, difficulty: Difficulty): Coord {
  if (difficulty === 'easy') {
    return randomNextShot(shots);
  }
  // Medium: parity hunt; if we have a single pending hit in cluster, try a random neighbor
  if (difficulty === 'medium') {
    if (mem.cluster.length > 0) {
      const last = fromKey(mem.cluster[mem.cluster.length - 1]);
      const opts = shuffled(neighbors(last).filter((c) => !shots.has(keyOf(c))));
      if (opts.length > 0) return opts[0];
    }
    const p = nextHuntParity(shots, mem.parity);
    return p ?? randomNextShot(shots);
  }
  // Hard: target mode using queue first
  while (mem.targetQueue.length > 0) {
    const k = mem.targetQueue.shift()!;
    if (!shots.has(k)) return fromKey(k);
  }
  // If queue empty but we still have a cluster (unsunk ship), recompute extensions
  if (mem.cluster.length > 0) {
    const cand = targetsFromCluster(shots, mem.cluster, mem.sizesLeft);
    if (cand.length > 0) return fromKey(cand[0]);
  }
  const p = nextHuntParity(shots, mem.parity);
  return p ?? randomNextShot(shots);
}

export function updateAIMemory(mem: AIMemory, difficulty: Difficulty, target: Coord, result: ShotResult, shotsAfter: Set<string>): AIMemory {
  const next: AIMemory = { ...mem, targetQueue: [...mem.targetQueue], cluster: [...mem.cluster], sizesLeft: [...mem.sizesLeft] };
  const k = keyOf(target);
  if (difficulty === 'easy') return next; // stateless

  if (result.win) {
    // game over — memory irrelevant but keep consistent
    next.targetQueue = [];
    next.cluster = [];
    return next;
  }
  if (result.hit) {
    next.cluster.push(k);
    if (result.sunk) {
      // Remove one ship of this cluster length from sizesLeft and clear targeting
      const sz = next.cluster.length;
      const idx = next.sizesLeft.findIndex((x) => x === sz);
      if (idx >= 0) next.sizesLeft.splice(idx, 1);
      next.targetQueue = [];
      next.cluster = [];
    } else {
      if (difficulty === 'medium') {
        // enqueue neighbors of this hit
        const opts = shuffled(neighbors(target))
          .map(keyOf)
          .filter((kk) => !shotsAfter.has(kk));
        next.targetQueue.push(...opts);
      } else {
        // hard — derive next targets from the entire cluster considering remaining sizes
        targetsFromCluster(shotsAfter, next.cluster, next.sizesLeft)
          .forEach((kk) => next.targetQueue.push(kk));
      }
    }
  }
  return next;
}
