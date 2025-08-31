import { FLEET_SIZES, ShipSize, Orientation, canPlace, placeShip, type Coord, type Player as PlayerEngine } from '@app/engine';

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

