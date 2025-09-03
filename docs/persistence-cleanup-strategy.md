# Persistence Cleanup Strategy

## Current Persistence Analysis

The game uses `localStorage` to persist:

### 1. **Game State** (`kids-battleships:game:v1`)
- Complete game state including phases, players, ships, shots, AI memory
- Stored continuously during gameplay 
- Cleared only on explicit "Restart" or `clearState()`
- **Size**: Approximately 2-10KB per saved game

### 2. **Online Session Tokens** (`kids-battleships:session:${room}`)
- WebSocket session tokens for multiplayer reconnection
- One per room code the user has joined
- **Never cleaned up automatically**
- **Size**: ~100 bytes per session

## 🚨 Issues Identified

### **Session Token Accumulation**
- Every room a user joins creates a new localStorage entry
- Room codes like `ABC-DEF` create entries like `kids-battleships:session:ABC-DEF`
- **No expiration or cleanup mechanism**
- Over time: `session:ABC123`, `session:DEF456`, `session:GHI789`, etc.

### **Stale Game States** 
- Game states persist indefinitely until manually cleared
- Kids might accumulate many abandoned games
- Parents/teachers might want to reset all progress

### **localStorage Quota**
- Most browsers limit localStorage to 5-10MB
- With many sessions + large game states, kids could hit limits
- No graceful handling of quota exceeded errors

## 🧹 Cleanup Strategy

### **Immediate Needs (High Priority)**

#### 1. **Session Token Expiration**
```typescript
// Add to useWebSocket.ts or new cleanup utility
const SESSION_EXPIRY_DAYS = 7;
const isSessionExpired = (timestamp: number) => {
  return Date.now() - timestamp > SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
};

const cleanupExpiredSessions = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('kids-battleships:session:')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        if (stored.timestamp && isSessionExpired(stored.timestamp)) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key); // Remove corrupted entries
      }
    }
  }
};
```

#### 2. **Game State Age Limit**
```typescript
// Add timestamp to PersistedState
export type PersistedState = {
  // ... existing fields
  savedAt?: number; // timestamp when state was saved
};

// Modify saveState to include timestamp
export function saveState(state: PersistedState): void {
  try {
    const stateWithTimestamp = { ...state, savedAt: Date.now() };
    const json = JSON.stringify(stateWithTimestamp);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (_e) {
    // ignore storage errors
  }
}

// Add cleanup for old game states (30+ days old)
const GAME_STATE_EXPIRY_DAYS = 30;
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
```

### **Enhanced Features (Medium Priority)**

#### 3. **Storage Usage Monitor**
```typescript
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
```

#### 4. **User-Friendly Cleanup Options**
Add to settings menu or main interface:
```tsx
const CleanupOptions = () => {
  const handleClearOldSessions = () => {
    cleanupExpiredSessions();
    alert('Cleaned up old room connections! 🧹');
  };
  
  const handleClearAllData = () => {
    if (confirm('This will delete your current game. Are you sure?')) {
      // Clear all battleships data
      Object.keys(localStorage)
        .filter(key => key.startsWith('kids-battleships:'))
        .forEach(key => localStorage.removeItem(key));
      window.location.reload();
    }
  };
  
  return (
    <div className="cleanup-options">
      <button onClick={handleClearOldSessions}>
        🧹 Clean Old Rooms
      </button>
      <button onClick={handleClearAllData}>
        🗑️ Reset All Game Data
      </button>
    </div>
  );
};
```

### **Advanced Features (Low Priority)**

#### 5. **Smart Session Management**
```typescript
// Store sessions with metadata for better cleanup
interface SessionData {
  token: string;
  lastUsed: number;
  roomCode: string;
  playerName?: string;
}

const setSessionToken = (room: string, token: string, playerName?: string) => {
  const sessionData: SessionData = {
    token,
    lastUsed: Date.now(),
    roomCode: room,
    playerName
  };
  localStorage.setItem(`kids-battleships:session:${room}`, JSON.stringify(sessionData));
};
```

#### 6. **Quota Management**
```typescript
const handleQuotaExceeded = () => {
  // Auto-cleanup when storage is full
  console.warn('LocalStorage quota exceeded, cleaning up old data...');
  
  // 1. Remove expired sessions first
  cleanupExpiredSessions();
  
  // 2. If still full, remove oldest sessions
  const sessions = Object.keys(localStorage)
    .filter(key => key.startsWith('kids-battleships:session:'))
    .map(key => ({
      key,
      data: JSON.parse(localStorage.getItem(key) || '{}')
    }))
    .sort((a, b) => (a.data.lastUsed || 0) - (b.data.lastUsed || 0));
    
  // Remove oldest 50% of sessions
  sessions.slice(0, Math.floor(sessions.length / 2))
    .forEach(session => localStorage.removeItem(session.key));
};
```

## 📋 Implementation Recommendations

### **Phase 1: Immediate (1-2 hours)**
1. Add timestamp to game state saves
2. Implement basic session cleanup on app start
3. Add "Clear Old Rooms" button to settings

### **Phase 2: Enhanced (2-3 hours)**
1. Add storage usage monitoring
2. Implement quota exceeded handling
3. Add comprehensive cleanup options to UI

### **Phase 3: Advanced (3-4 hours)**
1. Smart session management with metadata
2. Automatic cleanup scheduling
3. User dashboard showing storage usage

## 🎯 Kid-Friendly Considerations

### **Parental Controls**
- "Reset Everything" button for teachers/parents
- Storage usage display in simple terms ("Using 5% of space")
- Automatic cleanup that doesn't interrupt gameplay

### **Safety Features**
- Never delete current active games
- Confirmation dialogs for destructive actions
- Recovery options for accidentally cleared data

### **Performance**
- Cleanup operations should be fast (<100ms)
- Background cleanup that doesn't block UI
- Progressive cleanup (clean a little bit each session)

## 🚨 Recommended First Step

Add this to `App.tsx` initialization:
```tsx
useEffect(() => {
  // Clean up expired sessions on app start (once per session)
  const hasCleanedThisSession = sessionStorage.getItem('cleanup-done');
  if (!hasCleanedThisSession) {
    cleanupExpiredSessions();
    sessionStorage.setItem('cleanup-done', 'true');
  }
}, []);
```

This provides immediate relief from session accumulation without affecting user experience!