# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo for a Battleships game built with TypeScript:

- `engine/` - Pure TypeScript game engine with immutable functions and no side effects
- `web/` - React + Vite frontend that consumes the engine via workspace dependency
- `backend/` - Convex backend functions and schema for online multiplayer
- Uses pnpm workspaces for dependency management

The web and backend import from the engine using `@app/engine` workspace alias.

## Common Commands

Install workspace dependencies:
```bash
pnpm install
```

Development server (runs Convex and web):
```bash
pnpm dev
```

Build packages (engine then web):
```bash
pnpm build
```

Preview production build:
```bash
pnpm preview
```

Individual workspace commands:
```bash
# Build engine only (TypeScript compilation to dist/)
pnpm -C engine build

# Build web app only (Vite build to dist/)
pnpm -C web build

# Run web dev server directly
pnpm -C web dev

# Run Convex locally (optional direct)
pnpm -C backend dev
```

Deploy Convex backend:
```bash
pnpm -C backend deploy
```

## Architecture Guidelines

### Engine (`engine/src/`)
- Pure functions only, no side effects
- All data structures are immutable
- Named exports from `index.ts`
- Core types: `Coord`, `Ship`, `Player`, `Orientation`, `ShipSize`
- Key functions: `placeShip()`, `fire()`, `canPlace()`, `allSunk()`

### Web App (`web/src/`)
- React function components with hooks
- Game state managed in `App.tsx` with persistence
- AI logic in `ai.ts` with difficulty levels (easy/medium/hard)
- Views: `PlacementView` (ship placement), `PlayView` (gameplay)
- Components: Grid rendering, overlays, confetti effects
- Sound effects and visual feedback for game events
- LocalStorage persistence for game state across sessions
- Online multiplayer using Convex reactive queries/mutations

### Backend (`backend/`)
- Convex functions for authoritative game state (`rooms.ts`)
- Schema defined in `schema.ts`
- Room-based multiplayer with 6–8 character room codes
- Server-side move validation to prevent cheating
- Session persistence for reconnection support

### Key Files
- `engine/src/index.ts` - Core game logic and types
- `web/src/App.tsx` - Main game state and phase management
- `web/src/ai.ts` - Computer opponent with hunt/target algorithms
- `web/src/persistence.ts` - Save/load game state
- `web/src/views/PlacementView.tsx` - Ship placement UI
- `web/src/views/PlayView.tsx` - Gameplay UI with dual grids
- `web/src/multiplayer/` - Online multiplayer logic via Convex hook
- `backend/rooms.ts` - Backend mutations/queries
- `backend/schema.ts` - Data model

## Game Modes & Flow

**Game Modes:**
- **Two Players (PVP)** - Local multiplayer on same device
- **Vs Computer (PVC)** - AI opponent with easy/medium/hard difficulty
- **Online** - Real-time multiplayer across devices using room codes

**Game Flow:**
1. **P1_PLACE** - Player 1 places ships
2. **P2_PLACE** - Player 2 places ships (or auto-place for computer)
3. **P1_TURN/P2_TURN** - Alternating turns firing at opponent's grid
4. **GAME_OVER** - When all ships of one player are sunk

## Code Style
- 2-space indentation, semicolons, single quotes preferred
- Function components in PascalCase files (`.tsx`)
- Variables/functions in camelCase
- Keep modules small and focused
- Engine functions must be pure and side-effect free

## Testing

**Current Setup:**
- Add tests as needed; no default E2E is configured for Convex

**Framework Recommendations:**
- Engine: Vitest unit tests in `engine/src/*.test.ts`
- Web: Vitest + React Testing Library in `web/src/**/*.test.tsx`
- Backend: Convex function tests (if introduced)

When adding tests, add scripts to individual `package.json` files and run selectively with `pnpm -C <workspace> test`.

## Development Environment

**Environment:**
- Dev: `pnpm dev` runs Convex and launches Vite with `VITE_CONVEX_URL` injected
- Prod: Deploy Convex (`pnpm -C backend deploy`) and build web with `VITE_CONVEX_URL`

See `docs/convex.md` for full details.

## Agent Tools
- Serena (code): Use to locate symbols and navigate code quickly. Examples: find a function by name (`find_symbol name_path:"placeShip" within engine/src`), get file overviews (`get_symbols_overview web/src/App.tsx`), and search by pattern for usages (e.g., `coordsFor`). Prefer symbol-based queries over raw text.
- Context7 (docs): Resolve the library, then fetch focused docs. Example: `resolve-library-id "vite"` ➜ `get-library-docs id topic:"build"`. Useful for Vite config, React 18 APIs, and TypeScript compiler options.
- Sequential-thinking (planning): For multi-step tasks, write short thoughts by stage (Problem Definition → Research → Analysis → Synthesis → Conclusion). Keep each thought actionable; update the next step as you learn.
