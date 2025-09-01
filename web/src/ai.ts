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
};

export function emptyAIMemory(): AIMemory {
  return { targetQueue: [], cluster: [], parity: (randInt(2) as 0 | 1) };
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
  // Hard: target mode using queue; otherwise parity hunt
  while (mem.targetQueue.length > 0) {
    const k = mem.targetQueue.shift()!;
    if (!shots.has(k)) return fromKey(k);
  }
  const p = nextHuntParity(shots, mem.parity);
  return p ?? randomNextShot(shots);
}

export function updateAIMemory(mem: AIMemory, difficulty: Difficulty, target: Coord, result: ShotResult, shotsAfter: Set<string>): AIMemory {
  const next: AIMemory = { ...mem, targetQueue: [...mem.targetQueue], cluster: [...mem.cluster] };
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
      // Clear targeting on sink
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
        // hard — refine orientation if 2+ hits, else enqueue all neighbors
        const clusterCoords = next.cluster.map(fromKey);
        if (clusterCoords.length >= 2) {
          const sameRow = clusterCoords.every((c) => c.r === clusterCoords[0].r);
          const sameCol = clusterCoords.every((c) => c.c === clusterCoords[0].c);
          if (sameRow || sameCol) {
            // extend both ends along the line
            const line = clusterCoords.sort((a, b) => sameRow ? a.c - b.c : a.r - b.r);
            const first = line[0];
            const last = line[line.length - 1];
            const ext1 = sameRow ? { r: first.r, c: first.c - 1 } : { r: first.r - 1, c: first.c };
            const ext2 = sameRow ? { r: last.r, c: last.c + 1 } : { r: last.r + 1, c: last.c };
            [ext1, ext2]
              .filter(inBounds)
              .map(keyOf)
              .filter((kk) => !shotsAfter.has(kk))
              .forEach((kk) => next.targetQueue.push(kk));
          }
        } else {
          // only 1 hit -> try neighbors
          const opts = shuffled(neighbors(target))
            .map(keyOf)
            .filter((kk) => !shotsAfter.has(kk));
          next.targetQueue.push(...opts);
        }
      }
    }
  }
  return next;
}

