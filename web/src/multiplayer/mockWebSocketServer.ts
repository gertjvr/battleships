// Mock WebSocket server for local development without Cloudflare DO
import { canPlace, fire, allSunk, FLEET_SIZES, placeShip, type Coord, type ShipSize, type Orientation, type Ship, type Player } from '@app/engine';

interface GameState {
  phase: 'P1_PLACE' | 'P2_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';
  p1: Player;
  p2: Player;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  orientation: Orientation;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface MockRoom {
  gameState: GameState;
  connections: Set<WebSocket>;
  playerSessions: Map<string, number>;
  sessions: WeakMap<WebSocket, string>;
}

class MockWebSocketServer {
  private rooms = new Map<string, MockRoom>();
  
  createRoom(roomId: string): MockRoom {
    const room: MockRoom = {
      gameState: this.createInitialState(),
      connections: new Set(),
      playerSessions: new Map(),
      sessions: new WeakMap()
    };
    this.rooms.set(roomId, room);
    return room;
  }

  handleConnection(roomId: string, ws: WebSocket) {
    const room = this.rooms.get(roomId) || this.createRoom(roomId);
    room.connections.add(ws);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(room, ws, msg);
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { code: 'BAD_MESSAGE', message: 'Invalid message format' } 
        }));
      }
    };

    ws.onclose = () => {
      room.connections.delete(ws);
      if (room.connections.size === 0) {
        // Clean up empty rooms after delay
        setTimeout(() => {
          if (room.connections.size === 0) {
            this.rooms.delete(roomId);
          }
        }, 30000);
      }
    };
  }

  handleMessage(room: MockRoom, ws: WebSocket, msg: any) {
    switch (msg.type) {
      case 'join':
        this.handleJoin(room, ws, msg.payload);
        break;
      case 'action':
        this.handleAction(room, ws, msg);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', id: msg.id }));
        break;
    }
  }

  handleJoin(room: MockRoom, ws: WebSocket, payload: any) {
    let player: number;
    let sessionToken = payload.sessionToken;

    if (sessionToken && room.playerSessions.has(sessionToken)) {
      player = room.playerSessions.get(sessionToken)!;
    } else {
      const assignedPlayers = new Set(room.playerSessions.values());
      if (!assignedPlayers.has(1)) {
        player = 1;
      } else if (!assignedPlayers.has(2)) {
        player = 2;
      } else {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { code: 'ROOM_FULL', message: 'Room full' } 
        }));
        return;
      }

      sessionToken = crypto.randomUUID();
      room.playerSessions.set(sessionToken, player);
    }

    room.sessions.set(ws, sessionToken);

    ws.send(JSON.stringify({
      type: 'state',
      payload: this.serializeState(room.gameState),
      meta: { player, sessionToken }
    }));
  }

  handleAction(room: MockRoom, ws: WebSocket, msg: any) {
    const { payload, id } = msg;
    const sessionToken = room.sessions.get(ws);
    const player = sessionToken ? room.playerSessions.get(sessionToken) : null;

    if (!player || payload.player !== player) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { code: 'INVALID_PLAYER', message: 'Action not allowed for this player' } 
      }));
      return;
    }

    // Apply action (simplified validation for mock)
    room.gameState = this.applyAction(room.gameState, payload);
    this.broadcast(room, { type: 'action', id, payload, meta: { ack: true } });
  }

  applyAction(state: GameState, payload: any): GameState {
    const newState = { ...state };

    switch (payload.type) {
      case 'place': {
        const { player, start, size, orientation } = payload;
        const fleet = player === 1 ? newState.p1.fleet : newState.p2.fleet;
        const newFleet = placeShip(fleet, start, size, orientation);
        
        if (player === 1) {
          newState.p1 = { ...newState.p1, fleet: newFleet };
          newState.p1PlaceIndex++;
        } else {
          newState.p2 = { ...newState.p2, fleet: newFleet };
          newState.p2PlaceIndex++;
        }

        if (newFleet.length === FLEET_SIZES.length) {
          if (player === 1 && newState.phase === 'P1_PLACE') {
            newState.phase = 'P2_PLACE';
          } else if (player === 2 && newState.phase === 'P2_PLACE') {
            newState.phase = 'P1_TURN';
          }
        }
        break;
      }

      case 'fire': {
        const { player, r, c } = payload;
        const attacker = player === 1 ? newState.p1 : newState.p2;
        const defender = player === 1 ? newState.p2 : newState.p1;
        
        const result = fire(attacker.shots, defender.fleet, { r, c });
        
        if (player === 1) {
          newState.p1 = { ...newState.p1, shots: result.attackerShots };
          newState.p2 = { ...newState.p2, fleet: result.defenderFleet };
        } else {
          newState.p2 = { ...newState.p2, shots: result.attackerShots };
          newState.p1 = { ...newState.p1, fleet: result.defenderFleet };
        }

        newState.log.push({
          type: 'fire',
          player,
          target: { r, c },
          hit: result.result.hit,
          sunk: result.result.sunk,
          win: result.result.win
        });

        if (result.result.win) {
          newState.phase = 'GAME_OVER';
          newState.winner = player;
        } else {
          newState.phase = player === 1 ? 'P2_TURN' : 'P1_TURN';
        }
        break;
      }

      case 'reset': {
        return this.createInitialState();
      }

      case 'setName': {
        const { player, name } = payload;
        newState.names = { ...newState.names, [player]: name };
        break;
      }
    }

    return newState;
  }

  broadcast(room: MockRoom, message: any) {
    const data = JSON.stringify(message);
    for (const ws of room.connections) {
      try {
        ws.send(data);
      } catch (error) {
        room.connections.delete(ws);
      }
    }
  }

  createInitialState(): GameState {
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

  serializeState(state: GameState) {
    return {
      ...state,
      p1: {
        fleet: state.p1.fleet.map(ship => ({ ...ship, hits: Array.from(ship.hits) })),
        shots: Array.from(state.p1.shots)
      },
      p2: {
        fleet: state.p2.fleet.map(ship => ({ ...ship, hits: Array.from(ship.hits) })),
        shots: Array.from(state.p2.shots)
      },
      log: state.log.slice(-50)
    };
  }
}

// Global mock server instance
const mockServer = new MockWebSocketServer();

// Override WebSocket for mock mode
export function enableMockWebSocket() {
  if (typeof window !== 'undefined') {
    const OriginalWebSocket = window.WebSocket;
    
    window.WebSocket = class MockWebSocket extends EventTarget {
      readyState = WebSocket.CONNECTING;
      url: string;
      
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      
      constructor(url: string) {
        super();
        this.url = url;
        
        // Extract room from URL
        const urlObj = new URL(url, 'ws://localhost');
        const room = urlObj.searchParams.get('room');
        
        if (!room) {
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED;
            this.dispatchEvent(new Event('error'));
          }, 0);
          return;
        }
        
        // Simulate connection delay
        setTimeout(() => {
          this.readyState = WebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
          mockServer.handleConnection(room, this as any);
        }, 100);
      }
      
      send(data: string) {
        if (this.readyState !== WebSocket.OPEN) {
          throw new Error('WebSocket is not open');
        }
        
        setTimeout(() => {
          const event = new MessageEvent('message', { data });
          this.dispatchEvent(event);
        }, 0);
      }
      
      close() {
        if (this.readyState === WebSocket.OPEN) {
          this.readyState = WebSocket.CLOSING;
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED;
            this.dispatchEvent(new Event('close'));
          }, 0);
        }
      }
      
      // Event handler properties
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: Event) => void) | null = null;
      
      addEventListener(type: string, listener: EventListener) {
        super.addEventListener(type, listener);
      }
    } as any;
    
    // Copy static constants
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  }
}