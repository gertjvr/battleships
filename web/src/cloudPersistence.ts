import type { PersistedState } from './persistence';

// Configuration
const API_BASE = import.meta.env.VITE_WS_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://127.0.0.1:8787';

// Generate a unique player ID for this browser session
function getPlayerId(): string {
  let playerId = localStorage.getItem('battleships-player-id');
  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem('battleships-player-id', playerId);
  }
  return playerId;
}

// Generate game ID from current state or create new one
function getGameId(): string {
  let gameId = sessionStorage.getItem('battleships-game-id');
  if (!gameId) {
    gameId = crypto.randomUUID();
    sessionStorage.setItem('battleships-game-id', gameId);
  }
  return gameId;
}

export async function saveStateToCloud(state: PersistedState): Promise<boolean> {
  try {
    const playerId = getPlayerId();
    const gameId = getGameId();
    
    const response = await fetch(`${API_BASE}/persistence/save?playerId=${playerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId,
        playerId,
        data: state
      })
    });
    
    if (!response.ok) {
      console.error('Failed to save game to cloud:', response.statusText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error saving game to cloud:', error);
    return false;
  }
}

export async function loadStateFromCloud(): Promise<PersistedState | null> {
  try {
    const playerId = getPlayerId();
    const gameId = getGameId();
    
    const response = await fetch(`${API_BASE}/persistence/load?playerId=${playerId}&gameId=${gameId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        // Game not found or expired
        return null;
      }
      console.error('Failed to load game from cloud:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data as PersistedState;
  } catch (error) {
    console.error('Error loading game from cloud:', error);
    return null;
  }
}

export async function clearStateFromCloud(): Promise<boolean> {
  try {
    const playerId = getPlayerId();
    const gameId = getGameId();
    
    const response = await fetch(`${API_BASE}/persistence/delete?playerId=${playerId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId,
        playerId
      })
    });
    
    if (!response.ok) {
      console.error('Failed to delete game from cloud:', response.statusText);
      return false;
    }
    
    // Clear session game ID so a new one will be generated
    sessionStorage.removeItem('battleships-game-id');
    
    return true;
  } catch (error) {
    console.error('Error deleting game from cloud:', error);
    return false;
  }
}

export async function getCloudStorageStats(): Promise<{
  totalGames: number;
  totalSizeKB: number;
  activeGames: number;
  expiredGames: number;
} | null> {
  try {
    const playerId = getPlayerId();
    const response = await fetch(`${API_BASE}/persistence/stats?playerId=${playerId}`);
    
    if (!response.ok) {
      console.error('Failed to get storage stats:', response.statusText);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return null;
  }
}

export async function cleanupCloudStorage(): Promise<{ cleanedGames: number } | null> {
  try {
    const playerId = getPlayerId();
    const response = await fetch(`${API_BASE}/persistence/cleanup?playerId=${playerId}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      console.error('Failed to cleanup storage:', response.statusText);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error cleaning up storage:', error);
    return null;
  }
}

// Hybrid approach: try cloud first, fallback to localStorage
export async function saveState(state: PersistedState): Promise<void> {
  // Always try to save to cloud first
  const cloudSuccess = await saveStateToCloud(state);
  
  if (!cloudSuccess) {
    // Fallback to localStorage if cloud fails
    console.warn('Cloud save failed, using localStorage fallback');
    try {
      const stateWithTimestamp = { ...state, savedAt: Date.now() };
      const json = JSON.stringify(stateWithTimestamp);
      localStorage.setItem('kids-battleships:game:v1', json);
    } catch (_e) {
      // ignore storage errors
    }
  }
}

export async function loadState(): Promise<PersistedState | null> {
  // Try cloud first
  const cloudState = await loadStateFromCloud();
  if (cloudState) {
    return cloudState;
  }
  
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem('kids-battleships:game:v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return parsed;
  } catch (_e) {
    return null;
  }
}

export async function clearState(): Promise<void> {
  // Try to clear from cloud
  await clearStateFromCloud();
  
  // Also clear localStorage
  try { 
    localStorage.removeItem('kids-battleships:game:v1'); 
  } catch {}
}