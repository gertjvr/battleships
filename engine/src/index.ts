export type Coord = { r: number; c: number };
export type Orientation = 'H' | 'V';
export type ShipSize = 2 | 3 | 4 | 5;

export type Ship = {
  id: string;
  size: ShipSize;
  coords: Coord[];
  hits: Set<string>;
};

export type Player = {
  fleet: Ship[];
  shots: Set<string>;
};

export const FLEET_SIZES: ShipSize[] = [5, 4, 3, 3, 2, 2];

export function keyOf(c: Coord): string {
  return `${c.r},${c.c}`;
}

export function inBounds(c: Coord): boolean {
  return c.r >= 0 && c.r < 10 && c.c >= 0 && c.c < 10;
}

export function coordsFor(start: Coord, size: number, orientation: Orientation): Coord[] {
  const result: Coord[] = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'H' ? start.r : start.r + i;
    const c = orientation === 'H' ? start.c + i : start.c;
    result.push({ r, c });
  }
  return result;
}

export function fleetHasAt(fleet: Ship[], target: Coord): Ship | undefined {
  const k = keyOf(target);
  for (const ship of fleet) {
    if (ship.coords.some((c) => keyOf(c) === k)) return ship;
  }
  return undefined;
}

export function canPlace(fleet: Ship[], start: Coord, size: ShipSize, orientation: Orientation): boolean {
  const coords = coordsFor(start, size, orientation);
  // bounds
  if (!coords.every(inBounds)) return false;
  // overlap
  for (const c of coords) {
    if (fleetHasAt(fleet, c)) return false;
  }
  return true;
}

export function placeShip(fleet: Ship[], start: Coord, size: ShipSize, orientation: Orientation): Ship[] {
  if (!canPlace(fleet, start, size, orientation)) return fleet;
  const id = `S${fleet.length + 1}`;
  const ship: Ship = { id, size, coords: coordsFor(start, size, orientation), hits: new Set() };
  return [...fleet, ship];
}

export function isSunk(ship: Ship): boolean {
  return ship.coords.every((c) => ship.hits.has(keyOf(c)));
}

export function allSunk(fleet: Ship[]): boolean {
  return fleet.length > 0 && fleet.every(isSunk);
}

export type ShotResult = {
  hit: boolean;
  sunk?: string; // ship id
  win?: boolean;
};

export function fire(
  attackerShots: Set<string>,
  defenderFleet: Ship[],
  target: Coord
): { attackerShots: Set<string>; defenderFleet: Ship[]; result: ShotResult } {
  const k = keyOf(target);
  if (attackerShots.has(k)) {
    // No-op repeat; return current state
    return { attackerShots: new Set(attackerShots), defenderFleet: defenderFleet.map(cloneShip), result: { hit: fleetHasAt(defenderFleet, target) ? true : false } };
  }
  const shots = new Set(attackerShots);
  shots.add(k);
  let hit = false;
  let sunk: string | undefined;
  const nextFleet = defenderFleet.map(cloneShip);
  const ship = fleetHasAt(nextFleet, target);
  if (ship) {
    hit = true;
    ship.hits.add(k);
    if (isSunk(ship)) sunk = ship.id;
  }
  const win = allSunk(nextFleet);
  return { attackerShots: shots, defenderFleet: nextFleet, result: { hit, sunk, win } };
}

function cloneShip(s: Ship): Ship {
  return { id: s.id, size: s.size, coords: s.coords.map((c) => ({ ...c })), hits: new Set(s.hits) };
}

