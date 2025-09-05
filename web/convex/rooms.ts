import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  canPlace,
  fire,
  FLEET_SIZES,
  placeShip,
  type Coord,
  type ShipSize,
  type Orientation,
  type Ship,
  type Player
} from '@app/engine';

interface GameState {
  phase: 'BOTH_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';
  p1: Player;
  p2: Player;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  p1Ready: boolean;
  p2Ready: boolean;
  p1Orientation: Orientation;
  p2Orientation: Orientation;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

interface ActionPayload {
  type:
    | 'place'
    | 'donePlacement'
    | 'fire'
    | 'reset'
    | 'setName'
    | 'setOrientation'
    | 'undo';
  player: 1 | 2;
  [key: string]: any;
}

function createInitialState(): GameState {
  return {
    phase: 'BOTH_PLACE',
    p1: { fleet: [], shots: new Set() },
    p2: { fleet: [], shots: new Set() },
    p1PlaceIndex: 0,
    p2PlaceIndex: 0,
    p1Ready: false,
    p2Ready: false,
    p1Orientation: 'H',
    p2Orientation: 'H',
    winner: null,
    names: {},
    log: []
  };
}

function serializeShip(ship: Ship) {
  return { ...ship, hits: Array.from(ship.hits) };
}

function deserializeShip(ship: any): Ship {
  return { ...ship, hits: new Set(ship.hits) } as Ship;
}

function serializeState(state: GameState) {
  return {
    ...state,
    p1: {
      fleet: state.p1.fleet.map(serializeShip),
      shots: Array.from(state.p1.shots)
    },
    p2: {
      fleet: state.p2.fleet.map(serializeShip),
      shots: Array.from(state.p2.shots)
    },
    log: state.log.slice(-50)
  };
}

function deserializeState(serialized: any): GameState {
  return {
    ...serialized,
    p1: {
      fleet: serialized.p1.fleet.map(deserializeShip),
      shots: new Set(serialized.p1.shots)
    },
    p2: {
      fleet: serialized.p2.fleet.map(deserializeShip),
      shots: new Set(serialized.p2.shots)
    }
  };
}

function applyActionToState(state: GameState, payload: ActionPayload): GameState {
  const newState: GameState = structuredClone(state);

  switch (payload.type) {
    case 'place': {
      const { player, start, size, orientation } = payload;
      const fleet = player === 1 ? newState.p1.fleet : newState.p2.fleet;
      if (!canPlace(fleet, start, size as ShipSize, orientation)) {
        return state;
      }
      const updatedFleet = placeShip(fleet, start as Coord, size as ShipSize, orientation as Orientation);
      if (player === 1) {
        newState.p1 = { ...newState.p1, fleet: updatedFleet };
        newState.p1PlaceIndex++;
      } else {
        newState.p2 = { ...newState.p2, fleet: updatedFleet };
        newState.p2PlaceIndex++;
      }
      // Do not log placement details to avoid leaking ship positions
      break;
    }

    case 'donePlacement': {
      const { player } = payload;
      if (player === 1) {
        newState.p1Ready = true;
      } else {
        newState.p2Ready = true;
      }
      if (newState.p1Ready && newState.p2Ready) {
        newState.phase = 'P1_TURN';
      }
      newState.log.push({ type: 'playerReady', player, message: `Player ${player} is ready!` });
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
      return createInitialState();
    }

    case 'setName': {
      const { player, name } = payload;
      newState.names = { ...newState.names, [player]: name };
      break;
    }

    case 'setOrientation': {
      const { player, orientation } = payload;
      if (player === 1) {
        newState.p1Orientation = orientation;
      } else {
        newState.p2Orientation = orientation;
      }
      break;
    }

    case 'undo': {
      const { player } = payload;
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

function isPlayerTurn(state: GameState, player: 1 | 2): boolean {
  return (player === 1 && state.phase === 'P1_TURN') || (player === 2 && state.phase === 'P2_TURN');
}

function shotKey(c: { r: number; c: number }): string {
  return `${c.r},${c.c}`;
}

function validateAction(state: GameState, payload: ActionPayload): string | null {
  const { type, player } = payload;

  // Disallow further gameplay actions after game over, but allow reset/name updates
  if (state.phase === 'GAME_OVER' && type !== 'reset' && type !== 'setName') {
    return 'GAME_OVER';
  }

  switch (type) {
    case 'place': {
      if (state.phase !== 'BOTH_PLACE') return 'INVALID_PHASE';
      const ready = player === 1 ? state.p1Ready : state.p2Ready;
      if (ready) return 'ALREADY_READY';
      const placeIndex = player === 1 ? state.p1PlaceIndex : state.p2PlaceIndex;
      if (placeIndex >= FLEET_SIZES.length) return 'PLACEMENT_COMPLETE';
      // Enforce placing ships in the expected order
      if (payload.size !== FLEET_SIZES[placeIndex]) return 'WRONG_SHIP_SIZE';
      return null;
    }
    case 'donePlacement': {
      if (state.phase !== 'BOTH_PLACE') return 'INVALID_PHASE';
      const ready = player === 1 ? state.p1Ready : state.p2Ready;
      if (ready) return 'ALREADY_READY';
      const placeIndex = player === 1 ? state.p1PlaceIndex : state.p2PlaceIndex;
      if (placeIndex < FLEET_SIZES.length) return 'INCOMPLETE_FLEET';
      return null;
    }
    case 'fire': {
      if (!(state.p1Ready && state.p2Ready)) return 'NOT_READY';
      if (!isPlayerTurn(state, player)) return 'NOT_YOUR_TURN';
      if (typeof payload.r !== 'number' || typeof payload.c !== 'number') return 'INVALID_TARGET';
      if (payload.r < 0 || payload.r >= 10 || payload.c < 0 || payload.c >= 10) return 'OUT_OF_BOUNDS';
      const shots = player === 1 ? state.p1.shots : state.p2.shots;
      if (shots.has(shotKey({ r: payload.r, c: payload.c }))) return 'DUPLICATE_SHOT';
      return null;
    }
    case 'undo': {
      if (state.phase !== 'BOTH_PLACE') return 'INVALID_PHASE';
      const ready = player === 1 ? state.p1Ready : state.p2Ready;
      if (ready) return 'ALREADY_READY';
      const placeIndex = player === 1 ? state.p1PlaceIndex : state.p2PlaceIndex;
      if (placeIndex <= 0) return 'NOTHING_TO_UNDO';
      return null;
    }
    case 'setOrientation': {
      if (state.phase !== 'BOTH_PLACE') return 'INVALID_PHASE';
      const ready = player === 1 ? state.p1Ready : state.p2Ready;
      if (ready) return 'ALREADY_READY';
      if (payload.orientation !== 'H' && payload.orientation !== 'V') return 'INVALID_ORIENTATION';
      return null;
    }
    case 'setName':
    case 'reset':
      return null;
    default:
      return 'UNKNOWN_ACTION';
  }
}

export const getRoom = query({
  args: { roomCode: v.string() },
  handler: async (ctx, { roomCode }) => {
    return await ctx.db
      .query('rooms')
      .withIndex('roomCode', q => q.eq('roomCode', roomCode))
      .unique();
  }
});

export const joinRoom = mutation({
  args: { roomCode: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { roomCode, sessionToken }) => {
    let room = await ctx.db
      .query('rooms')
      .withIndex('roomCode', q => q.eq('roomCode', roomCode))
      .unique();
    const now = Date.now();
    if (!room) {
      const id = await ctx.db.insert('rooms', {
        roomCode,
        state: serializeState(createInitialState()),
        player1Session: undefined,
        player2Session: undefined,
        names: {},
        recentActionIds: [],
        updatedAt: now
      });
      room = await ctx.db.get(id);
    }

    if (!room) {
      throw new Error('Failed to create or retrieve room');
    }

    // Expire stale sessions
    if (
      room.player1Session &&
      room.player1LastSeen &&
      now - room.player1LastSeen > SESSION_TIMEOUT_MS
    ) {
      await ctx.db.patch(room._id, {
        player1Session: undefined,
        player1LastSeen: undefined
      });
      room.player1Session = undefined;
    }
    if (
      room.player2Session &&
      room.player2LastSeen &&
      now - room.player2LastSeen > SESSION_TIMEOUT_MS
    ) {
      await ctx.db.patch(room._id, {
        player2Session: undefined,
        player2LastSeen: undefined
      });
      room.player2Session = undefined;
    }

    let player: 1 | 2;
    if (sessionToken && sessionToken === room.player1Session) {
      player = 1;
      await ctx.db.patch(room._id, { updatedAt: now, player1LastSeen: now });
    } else if (sessionToken && sessionToken === room.player2Session) {
      player = 2;
      await ctx.db.patch(room._id, { updatedAt: now, player2LastSeen: now });
    } else if (!room.player1Session) {
      player = 1;
      sessionToken = sessionToken || crypto.randomUUID();
      await ctx.db.patch(room._id, {
        player1Session: sessionToken,
        player1LastSeen: now,
        updatedAt: now
      });
    } else if (!room.player2Session) {
      player = 2;
      sessionToken = sessionToken || crypto.randomUUID();
      await ctx.db.patch(room._id, {
        player2Session: sessionToken,
        player2LastSeen: now,
        updatedAt: now
      });
    } else {
      throw new Error('ROOM_FULL');
    }

    return {
      state: room.state,
      player,
      sessionToken
    };
  }
});

export const applyAction = mutation({
  args: {
    roomCode: v.string(),
    sessionToken: v.string(),
    payload: v.any(),
    id: v.optional(v.string())
  },
  handler: async (ctx, { roomCode, sessionToken, payload, id }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('roomCode', q => q.eq('roomCode', roomCode))
      .unique();
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const player =
      sessionToken === room.player1Session
        ? 1
        : sessionToken === room.player2Session
        ? 2
        : null;
    if (!player || payload.player !== player) {
      throw new Error('INVALID_PLAYER');
    }

    if (id && room.recentActionIds.includes(id)) {
      return { state: room.state };
    }

    const state = deserializeState(room.state);
    const validationError = validateAction(state, payload as ActionPayload);
    if (validationError) {
      throw new Error(`INVALID_ACTION:${validationError}`);
    }
    const newState = applyActionToState(state, payload);
    const serialized = serializeState(newState);
    const recent = id ? [...room.recentActionIds, id] : room.recentActionIds.slice();
    if (recent.length > 100) {
      recent.splice(0, recent.length - 100);
    }
    const now = Date.now();
    const patch: any = {
      state: serialized,
      recentActionIds: recent,
      updatedAt: now,
      ...(player === 1 ? { player1LastSeen: now } : { player2LastSeen: now })
    };
    await ctx.db.patch(room._id, patch);
    return { state: serialized };
  }
});

export const cleanupRooms = mutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const finishedAgo = now - 60 * 60 * 1000;
    const rooms = await ctx.db.query('rooms').collect();
    for (const room of rooms) {
      const last = room.updatedAt || 0;
      const state = deserializeState(room.state);
      if (state.phase === 'GAME_OVER' && last < finishedAgo) {
        await ctx.db.delete(room._id);
        continue;
      }
      if (last < dayAgo) {
        await ctx.db.delete(room._id);
      }
    }
  }
});
