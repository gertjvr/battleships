# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo for a Battleships game built with TypeScript:

- `engine/` - Pure TypeScript game engine with immutable functions and no side effects
- `web/` - React + Vite frontend that consumes the engine via workspace dependency
- Uses pnpm workspaces for dependency management

The web app imports from the engine using `@app/engine` workspace alias.

## Common Commands

Install workspace dependencies:
```bash
pnpm install
```

Development server (runs web app via Vite):
```bash
pnpm dev
```

Build both packages (engine first, then web):
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

### Key Files
- `engine/src/index.ts` - Core game logic and types
- `web/src/App.tsx` - Main game state and phase management
- `web/src/ai.ts` - Computer opponent with hunt/target algorithms
- `web/src/persistence.ts` - Save/load game state
- `web/src/views/PlacementView.tsx` - Ship placement UI
- `web/src/views/PlayView.tsx` - Gameplay UI with dual grids

## Game Flow
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
No testing framework currently configured. When adding tests, use Vitest for both engine and web packages with appropriate scripts in individual `package.json` files.