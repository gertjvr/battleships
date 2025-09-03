import type { Player, Ship } from '@app/engine';

// LocalStorage key and simple versioning for possible future migrations
const STORAGE_KEY = 'kids-battleships:game:v1';

export type Phase = 'P1_PLACE' | 'P2_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';
export type Mode = 'PVP' | 'PVC' | 'ONLINE' | 'SPECTATOR';
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
      sizesLeft?: number[];
    };
  };
  savedAt?: number;
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
    const stateWithTimestamp = { ...state, savedAt: Date.now() };
    const json = JSON.stringify(stateWithTimestamp);
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

// Cleanup constants
const SESSION_EXPIRY_DAYS = 7;
const GAME_STATE_EXPIRY_DAYS = 1;

// Session token cleanup
const isSessionExpired = (timestamp: number) => {
  return Date.now() - timestamp > SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
};

export function cleanupExpiredSessions(): number {
  let cleanedCount = 0;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('kids-battleships:session:')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        if (stored.timestamp && isSessionExpired(stored.timestamp)) {
          keysToRemove.push(key);
        } else if (!stored.timestamp) {
          // Remove sessions without timestamps (legacy format)
          keysToRemove.push(key);
        }
      } catch {
        // Remove corrupted entries
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    cleanedCount++;
  });
  
  return cleanedCount;
}

// Game state cleanup
export function cleanupOldGameState(): boolean {
  const state = loadState();
  if (state?.savedAt) {
    const daysSinceModified = (Date.now() - state.savedAt) / (24 * 60 * 60 * 1000);
    if (daysSinceModified > GAME_STATE_EXPIRY_DAYS) {
      clearState();
      return true; // State was expired and cleared
    }
  }
  return false; // State is still valid
}

// Storage usage monitoring
export function getStorageUsage() {
  let totalSize = 0;
  let battleshipsSize = 0;
  let sessionCount = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key || '');
    const size = (key?.length || 0) + (value?.length || 0);
    totalSize += size;
    
    if (key?.startsWith('kids-battleships:')) {
      battleshipsSize += size;
      if (key.includes(':session:')) sessionCount++;
    }
  }
  
  return {
    totalSize,
    battleshipsSize,
    sessionCount,
    percentageUsed: (totalSize / (10 * 1024 * 1024)) * 100 // Assume 10MB limit
  };
}

// Clear all battleships data
export function clearAllBattleshipsData(): number {
  let clearedCount = 0;
  const keysToRemove = Object.keys(localStorage)
    .filter(key => key.startsWith('kids-battleships:'));
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    clearedCount++;
  });
  
  return clearedCount;
}
