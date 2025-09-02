# Battleships

A multiplayer Battleships game built with TypeScript, React, and Cloudflare Workers. Features local multiplayer, AI opponents, and real-time online multiplayer across devices.

## Game Modes

- **Two Players (PVP)**: Local multiplayer on the same device
- **Vs Computer (PVC)**: Play against AI with 3 difficulty levels (easy, medium, hard)
- **Online**: Real-time multiplayer across different devices and locations

## Project Structure

```
engine/   # TypeScript game engine (pure functions)
  src/    # Game logic and types
web/      # React + Vite frontend
  src/    # UI components, views, multiplayer logic
worker/   # Cloudflare Worker for online multiplayer
  src/    # Durable Objects, WebSocket handling
```

- Language: TypeScript (strict, ES modules)
- UI: React function components via Vite
- Workspace: `pnpm` with `pnpm-workspace.yaml`

## Getting Started

Prerequisites:

- pnpm installed (`npm i -g pnpm`)
- Node.js (LTS recommended)

Install dependencies (workspace-wide):

```bash
pnpm install
```

Run the web app in development with mock multiplayer:

```bash
pnpm dev
```

The development server includes a mock WebSocket server that allows you to test online multiplayer locally without needing Cloudflare Workers.

## Build

Build the engine, then the web app (root convenience):

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

Component builds:

```bash
# Type-check and emit engine to engine/dist
pnm -C engine build

# Build the web app to web/dist
pnpm -C web build
```

## Online Multiplayer Setup

### Local Development (Mock Mode)

The app runs in mock mode by default during development (`VITE_MOCK_WS=true`). This allows you to test online multiplayer features without a real WebSocket server.

### Production Deployment

1. **Deploy the Worker:**
   ```bash
   cd worker
   pnpm install
   wrangler login
   wrangler deploy
   ```

2. **Update web environment variables:**
   - Update `web/.env.production` with your actual worker URL
   - Set `VITE_MOCK_WS=false`

3. **Deploy the web app:**
   ```bash
   pnpm -C web build
   # Deploy dist/ folder to your hosting service (Cloudflare Pages, Vercel, etc.)
   ```

### How Online Multiplayer Works

- Players create or join rooms using 6-8 character codes
- Cloudflare Durable Objects maintain authoritative game state
- All moves are validated server-side to prevent cheating
- Real-time synchronization via WebSockets with automatic reconnection
- Session persistence allows reconnecting to ongoing games

## Usage in the Web App

The web package consumes the engine via the workspace alias:

```ts
import { /* named exports */ } from '@app/engine';
```

## Coding Guidelines

- Engine: pure functions, named exports, no side effects; keep data immutable.
- React: function components in `PascalCase` files (e.g., `App.tsx`).
- Naming: variables/functions `camelCase`.
- Style: 2-space indent; semicolons; prefer single quotes.
- Keep modules small and focused; colocate UI components under `web/src/components/` and views under `web/src/views/`.

## Environment & Security

- Client-only app; do not commit secrets.
- If environment variables are introduced, use Vite `VITE_*` prefixed vars and document them.

## Testing

Testing frameworks are not set up yet. Preferred approach:

- Engine: Vitest unit tests in `engine/src/*.test.ts`.
- Web: Vitest + React Testing Library in `web/src/**/*.test.tsx`.

When adding tests, also add scripts, for example:

```jsonc
// engine/package.json
{
  "scripts": {
    "test": "vitest"
  }
}

// web/package.json
{
  "scripts": {
    "test": "vitest"
  }
}
```

Run selectively with `pnpm -C engine test` or `pnpm -C web test`.

## Common Scripts

- `pnpm install`: Install workspace dependencies.
- `pnpm dev`: Run the Vite dev server for `web/`.
- `pnpm -C engine build`: Type-check and emit engine to `engine/dist/`.
- `pnpm -C web build`: Build the web app to `web/dist/`.
- `pnpm build`: Build engine then web.
- `pnpm preview`: Preview the built web app locally.

## Contributing

- Commits: Imperative present tense (e.g., `feat(web): highlight last shot`). Keep changes small and scoped.
- PRs: Include a concise description, motivation, and testing steps. Ensure `pnpm build` passes and the app runs via `pnpm preview`. Include screenshots/GIFs for UI changes when possible.

---

Happy hacking!
