import { canPlace, fire, allSunk, FLEET_SIZES, placeShip, type Coord, type ShipSize, type Orientation, type Ship, type Player } from '@app/engine';

interface GameState {
  phase: 'BOTH_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';
  p1: Player;
  p2: Player;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  p1Ready: boolean;
  p2Ready: boolean;
  orientation: Orientation;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface ActionPayload {
  type: 'place' | 'donePlacement' | 'fire' | 'reset' | 'setName' | 'setOrientation' | 'undo';
  player: 1 | 2;
  [key: string]: any;
}

export class GameRoom implements DurableObject {
  private connections = new Set<WebSocket>();
  private gameState: GameState | null = null;
  private playerSessions = new Map<string, number>(); // sessionToken → player
  private sessions = new WeakMap<WebSocket, string>(); // WebSocket → sessionToken
  private recentActions = new Set<string>(); // Last 100 action IDs

  constructor(private state: DurableObjectState, private env: any) {}

  async init() {
    const stored = await this.state.storage.get('snapshot');
    this.gameState = stored ? this.deserializeState(stored) : this.createInitialState();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      await this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }

  async handleSession(ws: WebSocket) {
    ws.accept();
    this.connections.add(ws);

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
            if (first) {
              this.recentActions.delete(first);
            }
          }
        }

        await this.handleMessage(ws, msg);
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { code: 'BAD_MESSAGE', message: 'Invalid message format' } 
        }));
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
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', id: msg.id }));
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
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { code: 'ROOM_FULL', message: 'Room full' } 
        }));
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
      payload: this.serializeState(snapshot),
      meta: { player, sessionToken }
    }));
  }

  async handleAction(ws: WebSocket, msg: any) {
    const { payload, id } = msg;
    const sessionToken = this.sessions.get(ws);
    const player = sessionToken ? this.playerSessions.get(sessionToken) : null;

    // Validate action ownership
    if (!player || payload.player !== player) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { code: 'INVALID_PLAYER', message: 'Action not allowed for this player' } 
      }));
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
      case 'reset':
        isValid = true; // Allow reset from any player
        break;
      case 'setName':
        isValid = true; // Allow name setting
        break;
      case 'setOrientation':
        isValid = this.validateSetOrientation(payload);
        break;
      case 'undo':
        isValid = this.validateUndo(payload);
        break;
    }

    if (!isValid) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { code: 'INVALID_ACTION', message: 'Invalid action' } 
      }));
      return;
    }

    // Apply action and broadcast to all clients with ack
    this.gameState = this.applyAction(this.gameState!, payload);
    const snapshot = this.serializeState(this.gameState);
    await this.state.storage.put('snapshot', snapshot);
    // Acknowledge action id for idempotency
    this.broadcast({ type: 'action', id, payload, meta: { ack: true } });
    // Also broadcast updated state so all clients sync to authoritative version
    this.broadcast({ type: 'state', payload: snapshot });
  }

  validatePlacement(payload: any): boolean {
    const { phase } = this.gameState!;
    const { player, start, size, orientation } = payload;

    // Only allow placement during BOTH_PLACE phase
    if (phase !== 'BOTH_PLACE') {
      return false;
    }

    // Check if player is already ready
    const isPlayerReady = player === 1 ? this.gameState!.p1Ready : this.gameState!.p2Ready;
    if (isPlayerReady) {
      return false; // Don't allow placing ships after marked as ready
    }

    // Get player's fleet and validate using engine function
    const fleet = player === 1 ? this.gameState!.p1.fleet : this.gameState!.p2.fleet;
    return canPlace(fleet, start, size, orientation);
  }

  validateFire(payload: any): boolean {
    const { phase } = this.gameState!;
    const { player, r, c } = payload;

    // Only allow firing during correct turn
    if ((player === 1 && phase !== 'P1_TURN') ||
        (player === 2 && phase !== 'P2_TURN')) {
      return false;
    }

    // Check if position already fired at using attacker's shot Set
    const attacker = player === 1 ? this.gameState!.p1 : this.gameState!.p2;
    return !attacker.shots.has(`${r},${c}`);
  }

  validateDonePlacement(payload: any): boolean {
    const { phase } = this.gameState!;
    const { player } = payload;

    // Only allow during placement phase
    if (phase !== 'BOTH_PLACE') {
      return false;
    }

    // Check if player is already ready
    const isPlayerReady = player === 1 ? this.gameState!.p1Ready : this.gameState!.p2Ready;
    if (isPlayerReady) {
      return false; // Already marked as ready
    }

    // Check if all ships are placed for this player using FLEET_SIZES
    const playerData = player === 1 ? this.gameState!.p1 : this.gameState!.p2;
    return playerData.fleet.length === FLEET_SIZES.length; // All 6 ships placed
  }

  validateSetOrientation(payload: any): boolean {
    const { phase } = this.gameState!;
    const { player } = payload;

    // Only allow during placement phase
    if (phase !== 'BOTH_PLACE') {
      return false;
    }

    // Check if player is already ready
    const isPlayerReady = player === 1 ? this.gameState!.p1Ready : this.gameState!.p2Ready;
    if (isPlayerReady) {
      return false; // Already marked as ready, no more changes allowed
    }

    return true;
  }

  validateUndo(payload: any): boolean {
    const { phase } = this.gameState!;
    const { player } = payload;

    // Only allow during placement phase
    if (phase !== 'BOTH_PLACE') {
      return false;
    }

    // Check if player is already ready
    const isPlayerReady = player === 1 ? this.gameState!.p1Ready : this.gameState!.p2Ready;
    if (isPlayerReady) {
      return false; // Already marked as ready, no more changes allowed
    }

    // Check if player has any ships to undo
    const playerData = player === 1 ? this.gameState!.p1 : this.gameState!.p2;
    if (playerData.fleet.length === 0) {
      return false; // No ships to undo
    }

    return true;
  }

  applyAction(state: GameState, payload: ActionPayload): GameState {
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

        // No automatic phase transition - placement is concurrent
        break;
      }

      case 'donePlacement': {
        const { player } = payload;
        
        // Mark player as ready
        if (player === 1) {
          newState.p1Ready = true;
        } else {
          newState.p2Ready = true;
        }

        // Check if both players are ready
        if (newState.p1Ready && newState.p2Ready) {
          newState.phase = 'P1_TURN'; // Start battle with Player 1's turn
        }
        
        // Add log entry for ready status
        newState.log.push({
          type: 'playerReady',
          player,
          message: `Player ${player} is ready!`
        });
        
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

        // Add to log
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
          // Switch turns
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

      case 'setOrientation': {
        const { orientation } = payload;
        newState.orientation = orientation;
        break;
      }

      case 'undo': {
        const { player } = payload;
        
        // Remove the last ship from the player's fleet
        if (player === 1) {
          newState.p1 = { ...newState.p1, fleet: newState.p1.fleet.slice(0, -1) };
          newState.p1PlaceIndex = Math.max(0, newState.p1PlaceIndex - 1);
        } else {
          newState.p2 = { ...newState.p2, fleet: newState.p2.fleet.slice(0, -1) };
          newState.p2PlaceIndex = Math.max(0, newState.p2PlaceIndex - 1);
        }
        break;
      }
    }

    return newState;
  }

  broadcast(message: any) {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      try {
        ws.send(data);
      } catch (error) {
        // Remove dead connections
        this.connections.delete(ws);
      }
    }
  }

  createInitialState(): GameState {
    return {
      phase: 'BOTH_PLACE',
      p1: { fleet: [], shots: new Set() },
      p2: { fleet: [], shots: new Set() },
      p1PlaceIndex: 0,
      p2PlaceIndex: 0,
      p1Ready: false,
      p2Ready: false,
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

  deserializeState(serialized: any): GameState {
    return {
      ...serialized,
      p1: {
        fleet: serialized.p1.fleet.map(this.deserializeShip),
        shots: new Set(serialized.p1.shots)
      },
      p2: {
        fleet: serialized.p2.fleet.map(this.deserializeShip),
        shots: new Set(serialized.p2.shots)
      }
    };
  }

  serializeShip(ship: Ship) {
    return {
      ...ship,
      hits: Array.from(ship.hits)
    };
  }

  deserializeShip(serialized: any): Ship {
    return {
      ...serialized,
      hits: new Set(serialized.hits)
    };
  }
}
