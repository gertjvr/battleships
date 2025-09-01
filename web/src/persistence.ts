import type { Player, Ship } from '@app/engine';

// LocalStorage key and simple versioning for possible future migrations
const STORAGE_KEY = 'kids-battleships:game:v1';

export type Phase = 'P1_PLACE' | 'P2_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';
export type Mode = 'PVP' | 'PVC';
export type Difficulty = 'easy' | 'medium' | 'hard';

type PersistedShip = Omit<Ship, 'hits'> & { hits: string[] };
type PersistedPlayer = Omit<Player, 'shots' | 'fleet'> & { shots: string[]; fleet: PersistedShip[] };

export type PersistedState = {
  phase: Phase;
  p1: PersistedPlayer;
  p2: PersistedPlayer;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  orientation: 'H' | 'V';
  overlay?: { shown: boolean; message: string; next?: Phase };
  winner: 1 | 2 | null;
  names: { 1?: string; 2?: string };
  log: { attacker: 1 | 2; text: string; system?: boolean; key: string; side?: 1 | 2 }[];
  lastShotP1?: string | null;
  lastShotP2?: string | null;
  sunkOnP1?: string[] | null;
  sunkOnP2?: string[] | null;
  lastSunkOnP1?: string[] | null;
  lastSunkOnP2?: string[] | null;
  sinkingOnP1?: string[] | null;
  sinkingOnP2?: string[] | null;
  lockUI?: boolean;
  pendingHandoff?: { next: Phase; message: string } | null;
  mode?: Mode;
  ai?: {
    difficulty: Difficulty;
    mem?: {
      targetQueue?: string[];
      cluster?: string[];
      parity?: 0 | 1;
    };
  };
};

function serializeShip(s: Ship): PersistedShip {
  return { id: s.id, size: s.size, coords: s.coords.map((c) => ({ ...c })), hits: Array.from(s.hits) };
}

function deserializeShip(s: PersistedShip): Ship {
  return { id: s.id, size: s.size, coords: s.coords.map((c) => ({ ...c })), hits: new Set(s.hits) };
}

export function serializePlayer(p: Player): PersistedPlayer {
  return { shots: Array.from(p.shots), fleet: p.fleet.map(serializeShip) } as PersistedPlayer;
}

export function deserializePlayer(p: PersistedPlayer): Player {
  return { shots: new Set(p.shots), fleet: p.fleet.map(deserializeShip) } as Player;
}

export function saveState(state: PersistedState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (_e) {
    // ignore storage errors (quota/unsupported)
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return parsed;
  } catch (_e) {
    return null;
  }
}

export function clearState(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
