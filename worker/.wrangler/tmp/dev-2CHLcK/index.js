var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-RNo75b/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// ../engine/dist/index.js
var FLEET_SIZES = [5, 4, 3, 3, 2, 2];
function keyOf(c) {
  return `${c.r},${c.c}`;
}
__name(keyOf, "keyOf");
function inBounds(c) {
  return c.r >= 0 && c.r < 10 && c.c >= 0 && c.c < 10;
}
__name(inBounds, "inBounds");
function coordsFor(start, size, orientation) {
  const result = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === "H" ? start.r : start.r + i;
    const c = orientation === "H" ? start.c + i : start.c;
    result.push({ r, c });
  }
  return result;
}
__name(coordsFor, "coordsFor");
function fleetHasAt(fleet, target) {
  const k = keyOf(target);
  for (const ship of fleet) {
    if (ship.coords.some((c) => keyOf(c) === k))
      return ship;
  }
  return void 0;
}
__name(fleetHasAt, "fleetHasAt");
function canPlace(fleet, start, size, orientation) {
  const coords = coordsFor(start, size, orientation);
  if (!coords.every(inBounds))
    return false;
  for (const c of coords) {
    if (fleetHasAt(fleet, c))
      return false;
  }
  return true;
}
__name(canPlace, "canPlace");
function placeShip(fleet, start, size, orientation) {
  if (!canPlace(fleet, start, size, orientation))
    return fleet;
  const id = `S${fleet.length + 1}`;
  const ship = { id, size, coords: coordsFor(start, size, orientation), hits: /* @__PURE__ */ new Set() };
  return [...fleet, ship];
}
__name(placeShip, "placeShip");
function isSunk(ship) {
  return ship.coords.every((c) => ship.hits.has(keyOf(c)));
}
__name(isSunk, "isSunk");
function allSunk(fleet) {
  return fleet.length > 0 && fleet.every(isSunk);
}
__name(allSunk, "allSunk");
function fire(attackerShots, defenderFleet, target) {
  const k = keyOf(target);
  if (attackerShots.has(k)) {
    return { attackerShots: new Set(attackerShots), defenderFleet: defenderFleet.map(cloneShip), result: { hit: fleetHasAt(defenderFleet, target) ? true : false } };
  }
  const shots = new Set(attackerShots);
  shots.add(k);
  let hit = false;
  let sunk;
  const nextFleet = defenderFleet.map(cloneShip);
  const ship = fleetHasAt(nextFleet, target);
  if (ship) {
    hit = true;
    ship.hits.add(k);
    if (isSunk(ship))
      sunk = ship.id;
  }
  const win = allSunk(nextFleet);
  return { attackerShots: shots, defenderFleet: nextFleet, result: { hit, sunk, win } };
}
__name(fire, "fire");
function cloneShip(s) {
  return { id: s.id, size: s.size, coords: s.coords.map((c) => ({ ...c })), hits: new Set(s.hits) };
}
__name(cloneShip, "cloneShip");

// src/game-room.ts
var GameRoom = class {
  // Last 100 action IDs
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  static {
    __name(this, "GameRoom");
  }
  connections = /* @__PURE__ */ new Set();
  gameState = null;
  playerSessions = /* @__PURE__ */ new Map();
  // sessionToken → player
  sessions = /* @__PURE__ */ new WeakMap();
  // WebSocket → sessionToken
  recentActions = /* @__PURE__ */ new Set();
  async init() {
    const stored = await this.state.storage.get("snapshot");
    this.gameState = stored ? this.deserializeState(stored) : this.createInitialState();
  }
  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      await this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Not found", { status: 404 });
  }
  async handleSession(ws) {
    ws.accept();
    this.connections.add(ws);
    if (!this.gameState) {
      await this.init();
    }
    ws.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.recentActions.has(msg.id)) {
          return;
        }
        if (msg.id) {
          this.recentActions.add(msg.id);
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
          type: "error",
          payload: { code: "BAD_MESSAGE", message: "Invalid message format" }
        }));
      }
    });
    ws.addEventListener("close", () => {
      this.connections.delete(ws);
    });
  }
  async handleMessage(ws, msg) {
    switch (msg.type) {
      case "join":
        await this.handleJoin(ws, msg.payload);
        break;
      case "action":
        await this.handleAction(ws, msg);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong", id: msg.id }));
        break;
    }
  }
  async handleJoin(ws, payload) {
    let player;
    let sessionToken = payload.sessionToken;
    if (sessionToken && this.playerSessions.has(sessionToken)) {
      player = this.playerSessions.get(sessionToken);
    } else {
      const assignedPlayers = new Set(this.playerSessions.values());
      if (!assignedPlayers.has(1)) {
        player = 1;
      } else if (!assignedPlayers.has(2)) {
        player = 2;
      } else {
        ws.send(JSON.stringify({
          type: "error",
          payload: { code: "ROOM_FULL", message: "Room full" }
        }));
        return;
      }
      sessionToken = crypto.randomUUID();
      this.playerSessions.set(sessionToken, player);
    }
    this.sessions.set(ws, sessionToken);
    const snapshot = this.gameState || this.createInitialState();
    ws.send(JSON.stringify({
      type: "state",
      payload: this.serializeState(snapshot),
      meta: { player, sessionToken }
    }));
  }
  async handleAction(ws, msg) {
    const { payload, id } = msg;
    const sessionToken = this.sessions.get(ws);
    const player = sessionToken ? this.playerSessions.get(sessionToken) : null;
    if (!player || payload.player !== player) {
      ws.send(JSON.stringify({
        type: "error",
        payload: { code: "INVALID_PLAYER", message: "Action not allowed for this player" }
      }));
      return;
    }
    let isValid = false;
    switch (payload.type) {
      case "place":
        isValid = this.validatePlacement(payload);
        break;
      case "fire":
        isValid = this.validateFire(payload);
        break;
      case "donePlacement":
        isValid = this.validateDonePlacement(payload);
        break;
      case "reset":
        isValid = true;
        break;
      case "setName":
        isValid = true;
        break;
    }
    if (!isValid) {
      ws.send(JSON.stringify({
        type: "error",
        payload: { code: "INVALID_ACTION", message: "Invalid action" }
      }));
      return;
    }
    this.gameState = this.applyAction(this.gameState, payload);
    const snapshot = this.serializeState(this.gameState);
    await this.state.storage.put("snapshot", snapshot);
    this.broadcast({ type: "action", id, payload, meta: { ack: true } });
    this.broadcast({ type: "state", payload: snapshot });
  }
  validatePlacement(payload) {
    const { phase } = this.gameState;
    const { player, start, size, orientation } = payload;
    if (player === 1 && phase !== "P1_PLACE" || player === 2 && phase !== "P2_PLACE") {
      return false;
    }
    const fleet = player === 1 ? this.gameState.p1.fleet : this.gameState.p2.fleet;
    return canPlace(fleet, start, size, orientation);
  }
  validateFire(payload) {
    const { phase } = this.gameState;
    const { player, r, c } = payload;
    if (player === 1 && phase !== "P1_TURN" || player === 2 && phase !== "P2_TURN") {
      return false;
    }
    const attacker = player === 1 ? this.gameState.p1 : this.gameState.p2;
    return !attacker.shots.has(`${r},${c}`);
  }
  validateDonePlacement(payload) {
    const playerData = payload.player === 1 ? this.gameState.p1 : this.gameState.p2;
    return playerData.fleet.length === FLEET_SIZES.length;
  }
  applyAction(state, payload) {
    const newState = { ...state };
    switch (payload.type) {
      case "place": {
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
          if (player === 1 && newState.phase === "P1_PLACE") {
            newState.phase = "P2_PLACE";
          } else if (player === 2 && newState.phase === "P2_PLACE") {
            newState.phase = "P1_TURN";
          }
        }
        break;
      }
      case "donePlacement": {
        const { player } = payload;
        if (player === 1 && newState.phase === "P1_PLACE") {
          newState.phase = "P2_PLACE";
        } else if (player === 2 && newState.phase === "P2_PLACE") {
          newState.phase = "P1_TURN";
        }
        break;
      }
      case "fire": {
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
          type: "fire",
          player,
          target: { r, c },
          hit: result.result.hit,
          sunk: result.result.sunk,
          win: result.result.win
        });
        if (result.result.win) {
          newState.phase = "GAME_OVER";
          newState.winner = player;
        } else {
          newState.phase = player === 1 ? "P2_TURN" : "P1_TURN";
        }
        break;
      }
      case "reset": {
        return this.createInitialState();
      }
      case "setName": {
        const { player, name } = payload;
        newState.names = { ...newState.names, [player]: name };
        break;
      }
    }
    return newState;
  }
  broadcast(message) {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      try {
        ws.send(data);
      } catch (error) {
        this.connections.delete(ws);
      }
    }
  }
  createInitialState() {
    return {
      phase: "P1_PLACE",
      p1: { fleet: [], shots: /* @__PURE__ */ new Set() },
      p2: { fleet: [], shots: /* @__PURE__ */ new Set() },
      p1PlaceIndex: 0,
      p2PlaceIndex: 0,
      orientation: "H",
      winner: null,
      names: {},
      log: []
    };
  }
  serializeState(state) {
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
      log: state.log.slice(-50)
      // Cap log to 50 entries
    };
  }
  deserializeState(serialized) {
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
  serializeShip(ship) {
    return {
      ...ship,
      hits: Array.from(ship.hits)
    };
  }
  deserializeShip(serialized) {
    return {
      ...serialized,
      hits: new Set(serialized.hits)
    };
  }
};

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const room = url.searchParams.get("room");
      if (!room || !/^[A-Z0-9]{6,8}$/.test(room)) {
        return new Response("Invalid room parameter (6-8 alphanumeric characters required)", { status: 400 });
      }
      const id = env.GAME_ROOMS.idFromName(room);
      const stub = env.GAME_ROOMS.get(id);
      return stub.fetch(request);
    }
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  }
};

// ../../../../../Library/Caches/pnpm/dlx/843afd5ec29846bd970f79bfecfb743614f4bf36abf7fccae50e2aaf3314e64d/1990c290193-b24a/node_modules/.pnpm/wrangler@4.33.2/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../Library/Caches/pnpm/dlx/843afd5ec29846bd970f79bfecfb743614f4bf36abf7fccae50e2aaf3314e64d/1990c290193-b24a/node_modules/.pnpm/wrangler@4.33.2/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-RNo75b/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../Library/Caches/pnpm/dlx/843afd5ec29846bd970f79bfecfb743614f4bf36abf7fccae50e2aaf3314e64d/1990c290193-b24a/node_modules/.pnpm/wrangler@4.33.2/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-RNo75b/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  GameRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
