# Multiplayer Architecture for Cross-Device Battleships

Based on analysis of the current codebase and research into Cloudflare's multiplayer gaming solutions.

## Architecture Decision: Authoritative Durable Objects

**Recommendation**: Use authoritative validation in Durable Objects rather than simple message relay.

### Why Authoritative?
- **Prevents cheating**: Server validates all moves using existing engine functions
- **Eliminates desync**: Single source of truth prevents client drift
- **Simplifies reconnection**: Late joiners get authoritative state snapshot
- **Leverages existing logic**: Pure engine functions run identically in client and DO

### Durable Object Responsibilities
- **Room lifecycle**: Map roomId to WebSocket connections
- **Player assignment**: First connection becomes player=1, second becomes player=2
- **Session tokens**: Generate and track sessionToken for reconnection identity
- **Move validation**: Use `canPlace()`, `fire()` functions to validate actions
- **Action ownership**: Reject actions where payload.player doesn't match connection's assigned player
- **Phase enforcement**: Validate placement/firing actions against current game phase
- **State storage**: Keep current game state in memory, persist snapshots for late joiners
- **Broadcasting**: Relay validated actions and results to all clients

## Message Protocol

### Envelope Structure
```typescript
{
  type: 'join' | 'state' | 'action' | 'ping',
  room: string,
  payload: any,
  id?: string  // Client-generated for idempotency
}
```

### Action Types
- **place**: `{ player: 1|2, start: {r,c}, size: 2|3|4|5, orientation: 'H'|'V' }`
- **donePlacement**: `{ player: 1|2 }`
- **fire**: `{ player: 1|2, r: number, c: number }`
- **reset**: `{}`
- **setName**: `{ player: 1|2, name: string }`

### Action Acknowledgment
```typescript
// Client → DO (with unique ID)
{ type: 'action', id: 'uuid-123', payload: { type: 'fire', player: 1, r: 2, c: 3 } }

// DO → All Clients (including ack to originator)
{ type: 'action', id: 'uuid-123', payload: { type: 'fire', player: 1, r: 2, c: 3 }, meta: { ack: true } }
```

### State Snapshot
Uses existing serialization system:
```typescript
{
  phase, 
  p1: serializePlayer(p1), 
  p2: serializePlayer(p2), 
  p1PlaceIndex, 
  p2PlaceIndex, 
  orientation, 
  names, 
  log,
  // ... other game state
}
```

### Idempotency
- **Client ID generation**: Use `crypto.randomUUID()` for unique action IDs
- **Server deduplication**: DO maintains Set/LRU of last 100 action IDs per room
- **Duplicate handling**: Drop duplicate actions silently
- **Action acceptance**: Apply-on-ack model for MVP (no optimistic updates)
  - Client waits for server confirmation before applying state changes
  - Server includes original `id` in broadcast with `meta: { ack: true }` for acknowledgment
  - Clients match pending actions to server acks via the `id` field
  - Avoids rollback complexity during initial implementation

## Backend Architecture Options

### 1. Cloudflare Workers + Durable Objects (Recommended)
- **Architecture**: Cloudflare Pages (frontend) + Workers (WebSocket routing) + Durable Objects (game coordination)
- **WebSocket Support**: Built-in API with hibernation to reduce idle costs
- **Real-time Features**: Perfect for turn-based games - handles state sync, player matching, move validation
- **Cost Model**: Pay-per-use with hibernation during idle periods ([see Cloudflare pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/))
- **Integration**: Seamless with existing Cloudflare Pages deployment

#### Wrangler Configuration
```toml
# wrangler.toml
name = "battleships-ws"
main = "worker/src/index.ts"
compatibility_date = "2024-09-01"

[[durable_objects.bindings]]
name = "GAME_ROOMS"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_classes = ["GameRoom"]
```

### 2. Hybrid Approach (Future Enhancement)
- **Durable Objects**: Handle active game sessions and real-time coordination
- **D1**: Store completed games, player profiles, statistics
- **Workers**: API layer connecting both services
- **When to consider**: After MVP if you need persistent game history or player stats

## State Synchronization & Reconnection

### Player Assignment & Session Management
- **First connection**: Assigned player=1, receives room-scoped sessionToken
- **Second connection**: Assigned player=2, receives room-scoped sessionToken  
- **Session persistence**: Client stores per-room token in localStorage (`kids-battleships:session:${room}`)
- **Reconnection identity**: Client sends sessionToken; DO restores same player role
- **Room capacity**: Hard limit of 2 players per room

### Join Flow Messages
```typescript
// Client → DO
{ type: 'join', payload: { room: string, sessionToken?: string } }

// DO → Client
{ 
  type: 'state', 
  payload: gameSnapshot, 
  meta: { player: 1|2, sessionToken: string } 
}
```

### Reconnection Flow
1. **Client reconnects**: WebSocket reconnects with stored sessionToken
2. **DO validates session**: Restores player assignment from sessionToken
3. **DO sends snapshot**: Latest authoritative game state sent to client
4. **Client rehydrates**: Local state replaced with server snapshot
5. **Resume gameplay**: Client rejoins at current game phase

### Late Joiner Handling
- **Snapshot composition**: DO creates snapshot from authoritative state (never trusts client)
- **Snapshot fields**: Uses existing serialization system with capped log length
- **State persistence**: DO stores current snapshot in `state.storage`
- **Join response**: New connections receive complete game state
- **Spectator support**: Future enhancement for watching completed games

## Security & Abuse Prevention

### Minimal Trust Model
- **Server-side validation**: All actions validated using engine functions
- **No authentication**: MVP relies on session tokens for reconnection only
- **Room code security**: Use 6-8 alphanumeric codes to reduce collision/guessing
- **Rate limiting**: Optional for later; can drop excessive messages per connection

### Error Taxonomy
Standardized error responses for better client UX:
```typescript
// Error codes and messages
{ type: 'error', payload: { code: 'ROOM_FULL', message: 'Room full' } }
{ type: 'error', payload: { code: 'INVALID_ACTION', message: 'Invalid action' } }
{ type: 'error', payload: { code: 'BAD_MESSAGE', message: 'Invalid message format' } }
{ type: 'error', payload: { code: 'INVALID_PLAYER', message: 'Action not allowed for this player' } }
```

### Room Code Generation
```typescript
// Client generates 6-8 character alphanumeric room code
const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();

// Room capacity: Hard limit of 2 players
// Third connection attempt returns { type: 'error', payload: { code: 'ROOM_FULL', message: 'Room full' } }
```

## Current Codebase Readiness

The battleships game already has:
- ✅ **Pure engine functions**: `canPlace()`, `fire()` work identically in client/server
- ✅ **No Node-only APIs**: Engine code bundles safely into Workers
- ✅ **Serialization system**: `serializePlayer()` ready for state snapshots
- ✅ **Turn-based logic**: Maps perfectly to authoritative validation
- ✅ **Phase management**: P1_PLACE → P2_PLACE → P1_TURN → P2_TURN flow
- ✅ **Immutable updates**: All state changes return new objects
- ✅ **Action ordering**: Single DO instance serializes actions naturally

## Implementation Plan

### MVP Phase (1-2 days)
**Goal**: Action-sync multiplayer without persistence

1. **Create Worker** (`worker/src/index.ts`)
   - WebSocket routing: `/ws?room=XXXX` upgrades and forwards to DO
   - Room-based Durable Object instances
   
2. **Implement Durable Object** (`worker/src/game-room.ts`)
   - WebSocket management per room
   - Action validation using engine functions
   - State broadcasting to connected clients
   
3. **Add Client Integration** (`web/src/multiplayer/`)
   - WebSocket connection hook
   - Message handling with optimistic updates
   - ONLINE mode in App.tsx alongside existing PVP/PVC

4. **Basic UI** 
   - Host/Join interface for room creation
   - Connection status indicator

### Stabilization Phase (1-2 days)
**Goal**: Robust connection handling and UX polish

5. **Reconnection & Snapshots**
   - DO snapshot storage for late joiners
   - Client reconnection with state rehydration
   - Handle mid-game disconnections gracefully

6. **Error Handling & UX**
   - Connection retry logic
   - Network error feedback
   - Loading states and connection status

### Future Enhancements
- **Persistent game history**: Add D1 integration for completed games
- **Player profiles & stats**: Track wins/losses across sessions  
- **Spectator mode**: Watch completed or ongoing games
- **Room sharing**: QR codes or shareable links
- **Hibernation tuning**: Optimize DO sleep/wake for cost efficiency

## Technical Implementation Details

### Worker Structure
```typescript
// worker/src/index.ts
export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const room = url.searchParams.get('room');
      if (!room) {
        return new Response('Room parameter required', { status: 400 });
      }
      
      // Use idFromName for deterministic room codes
      const id = env.GAME_ROOMS.idFromName(room);
      const stub = env.GAME_ROOMS.get(id);
      return stub.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  }
};
```

### Durable Object Logic
```typescript
// worker/src/game-room.ts  
import { canPlace, fire, allSunk, FLEET_SIZES } from '@app/engine';

export class GameRoom {
  private connections = new Set<WebSocket>();
  private gameState: any = null;
  private playerSessions = new Map<string, number>(); // sessionToken → player
  private sessions = new WeakMap<WebSocket, string>(); // WebSocket → sessionToken
  private recentActions = new Set<string>(); // Last 100 action IDs
  
  constructor(private state: DurableObjectState, private env: any) {}
  
  async init() {
    // Load persisted state
    this.gameState = await this.state.storage.get('snapshot') ?? this.createInitialState();
  }
  
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = new WebSocketPair();
      await this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }
  
  async handleSession(ws: WebSocket) {
    ws.accept();
    this.connections.add(ws);
    
    // Initialize if needed
    if (!this.gameState) {
      await this.init();
    }
    
    ws.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        
        // Check for duplicate actions
        if (msg.id && this.recentActions.has(msg.id)) {
          return; // Drop duplicate silently
        }
        if (msg.id) {
          this.recentActions.add(msg.id);
          // Keep only last 100 IDs
          if (this.recentActions.size > 100) {
            const first = this.recentActions.values().next().value;
            this.recentActions.delete(first);
          }
        }
        
        await this.handleMessage(ws, msg);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { code: 'BAD_MESSAGE', message: 'Invalid message format' } }));
      }
    });
    
    ws.addEventListener('close', () => {
      this.connections.delete(ws);
    });
  }
  
  async handleMessage(ws: WebSocket, msg: any) {
    switch (msg.type) {
      case 'join':
        await this.handleJoin(ws, msg.payload);
        break;
      case 'action':
        await this.handleAction(ws, msg);
        break;
    }
  }
  
  async handleJoin(ws: WebSocket, payload: any) {
    let player: number;
    let sessionToken = payload.sessionToken;
    
    if (sessionToken && this.playerSessions.has(sessionToken)) {
      // Reconnecting player
      player = this.playerSessions.get(sessionToken)!;
    } else {
      // New player assignment
      const assignedPlayers = new Set(this.playerSessions.values());
      if (!assignedPlayers.has(1)) {
        player = 1;
      } else if (!assignedPlayers.has(2)) {
        player = 2;
      } else {
        ws.send(JSON.stringify({ type: 'error', payload: { code: 'ROOM_FULL', message: 'Room full' } }));
        return;
      }
      
      sessionToken = crypto.randomUUID();
      this.playerSessions.set(sessionToken, player);
    }
    
    // Map WebSocket to sessionToken for later lookup
    this.sessions.set(ws, sessionToken);
    
    // Send current state snapshot
    const snapshot = this.gameState || this.createInitialState();
    ws.send(JSON.stringify({
      type: 'state',
      payload: snapshot,
      meta: { player, sessionToken }
    }));
  }
  
  async handleAction(ws: WebSocket, msg: any) {
    const { payload, id } = msg;
    const sessionToken = this.sessions.get(ws);
    const player = sessionToken ? this.playerSessions.get(sessionToken) : null;
    
    // Validate action ownership
    if (!player || payload.player !== player) {
      ws.send(JSON.stringify({ type: 'error', payload: { code: 'INVALID_PLAYER', message: 'Action not allowed for this player' } }));
      return;
    }
    
    // Validate action based on type and game phase
    let isValid = false;
    switch (payload.type) {
      case 'place':
        isValid = this.validatePlacement(payload);
        break;
      case 'fire':
        isValid = this.validateFire(payload);
        break;
      case 'donePlacement':
        isValid = this.validateDonePlacement(payload);
        break;
    }
    
    if (!isValid) {
      ws.send(JSON.stringify({ type: 'error', payload: { code: 'INVALID_ACTION', message: 'Invalid action' } }));
      return;
    }
    
    // Apply action and broadcast to all clients with ack
    this.gameState = this.applyAction(this.gameState, payload);
    await this.state.storage.put('snapshot', this.serializeState(this.gameState));
    this.broadcast({ type: 'action', id, payload, meta: { ack: true } });
  }
  
  validatePlacement(payload: any): boolean {
    const { phase } = this.gameState;
    const { player } = payload;
    
    // Only allow placement during correct phase
    if ((player === 1 && phase !== 'P1_PLACE') || 
        (player === 2 && phase !== 'P2_PLACE')) {
      return false;
    }
    
    // Get player's fleet and validate using engine function
    const fleet = player === 1 ? this.gameState.p1.fleet : this.gameState.p2.fleet;
    return canPlace(fleet, payload.start, payload.size, payload.orientation);
  }
  
  validateFire(payload: any): boolean {
    const { phase } = this.gameState;
    const { player, r, c } = payload;
    
    // Only allow firing during correct turn
    if ((player === 1 && phase !== 'P1_TURN') ||
        (player === 2 && phase !== 'P2_TURN')) {
      return false;
    }
    
    // Check if position already fired at using attacker's shot Set
    const attacker = player === 1 ? this.gameState.p1 : this.gameState.p2;
    return !attacker.shots.has(`${r},${c}`);
  }
  
  validateDonePlacement(payload: any): boolean {
    // Check if all ships are placed for this player using FLEET_SIZES
    const playerData = payload.player === 1 ? this.gameState.p1 : this.gameState.p2;
    return playerData.fleet.length === FLEET_SIZES.length; // All 6 ships placed
  }
  
  broadcast(message: any) {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      ws.send(data);
    }
  }
  
  createInitialState() {
    // Return initial game state matching persistence format
    return {
      phase: 'P1_PLACE',
      p1: { fleet: [], shots: new Set() },
      p2: { fleet: [], shots: new Set() },
      p1PlaceIndex: 0,
      p2PlaceIndex: 0,
      orientation: 'H',
      winner: null,
      names: {},
      log: []
    };
  }
  
  serializeState(state: any) {
    // Convert Sets to arrays for JSON serialization
    return {
      ...state,
      p1: {
        fleet: state.p1.fleet.map(this.serializeShip),
        shots: Array.from(state.p1.shots)
      },
      p2: {
        fleet: state.p2.fleet.map(this.serializeShip),
        shots: Array.from(state.p2.shots)
      },
      log: state.log.slice(-50) // Cap log to 50 entries
    };
  }
  
  serializeShip(ship: any) {
    return {
      ...ship,
      hits: Array.from(ship.hits)
    };
  }
}
```

### Client Integration

#### Environment Configuration
```bash
# web/.env.local (development)
VITE_WS_URL=ws://127.0.0.1:8787

# web/.env.production
VITE_WS_URL=wss://battleships-ws.your-account.workers.dev
```

#### Worker Dependencies
```json
// worker/package.json
{
  "name": "battleships-worker",
  "dependencies": {
    "@app/engine": "workspace:*"
  }
}
```

**Important**: The Worker needs to import engine functions directly. Ensure Wrangler builds from the monorepo context or use relative imports to `../engine/src/index.ts`.

#### Development Setup
1. **Worker development**: `wrangler dev` (runs on :8787)
2. **Web development**: `pnpm -C web dev` with proxy or direct WS connection
3. **Optional Vite proxy**: Configure `^/ws` to forward to Worker

#### Frontend Integration
```typescript
// web/src/App.tsx - Add ONLINE mode
const [mode, setMode] = useState<'PVP' | 'PVC' | 'ONLINE'>('PVP');

// web/src/multiplayer/useWebSocket.ts
export function useWebSocket(room: string) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [player, setPlayer] = useState<1 | 2 | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    () => localStorage.getItem(`kids-battleships:session:${room}`)
  );
  
  // WebSocket connection management
  // Apply-on-ack message handling (no optimistic updates)
  // Automatic reconnection with exponential backoff
  // Per-room session token persistence
}
```

#### ONLINE Mode UI Rules
- **Player restrictions**: Disable UI for non-active player and when disconnected
- **Turn indicators**: Replace "pass device" overlays with connection/turn status banners
- **Connection feedback**: Show connecting/connected/disconnected states
- **Room sharing**: Display room code for second player to join

**Estimated Timeline**: 3-6 days for MVP + Stabilization
**Key Success Metric**: Two players can complete a full game across different devices