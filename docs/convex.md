# Convex Integration

This app now uses Convex for online multiplayer state and persistence.

## Overview
- Backend functions live in `backend/` (`rooms.ts`, `schema.ts`).
- The web app connects via `convex/react` using `ConvexProvider`.
- Client keeps a per-room session token in `localStorage` to retain your seat.

## Local Development
1. Install deps: `pnpm install`
2. Start dev: `pnpm dev`
   - Runs `engine` build first.
   - Starts `convex dev` in `backend/` and then launches Vite via Convex.
   - `VITE_CONVEX_URL` is injected automatically for the web app.
3. Open the app and navigate to `/#/online`.

Notes
- If you prefer running Vite yourself, you must provide `VITE_CONVEX_URL`:
  - Create `web/.env.local` with: `VITE_CONVEX_URL=<convex dev URL>`
  - Or run: `VITE_CONVEX_URL=<url> pnpm -C web dev`
- When editing Convex functions, optionally run `pnpm -C backend codegen` to refresh types in `backend/convex/_generated`.

## Production Deployment
1. Deploy Convex:
   - `pnpm -C backend run deploy`
   - Copy the public Convex URL that deploy prints (e.g., `https://<deployment>.convex.cloud`).
2. Build the web app with the Convex URL available to Vite:
   - Option A (env var): `VITE_CONVEX_URL=<public convex url> pnpm -C web build`
   - Option B (env file): create `web/.env.production` with:
     
     ```
     VITE_CONVEX_URL=<public convex url>
     ```
     then run `pnpm -C web build`.
3. Host `web/dist/` on any static hosting (Netlify, Vercel, GitHub Pages, etc.).

### Quick Deploy Commands
- First time:
  - `pnpm -C backend run deploy` (will prompt to log in/select or create a project and region)
- Subsequent deploys:
  - `pnpm -C backend run deploy`

The deploy output shows the public URL to use as `VITE_CONVEX_URL`.

## Troubleshooting
- Missing Convex URL: If the UI shows connection errors, confirm `VITE_CONVEX_URL` is set at runtime (dev) or build-time (prod).
- Engine import errors in Convex: ensure the engine has been built (`pnpm -C engine build`) before starting `convex dev` or deploying.
- Stale types: run `pnpm -C backend codegen`.

## Key Paths
- Backend: `backend/rooms.ts`, `backend/schema.ts`
- Client hook: `web/src/multiplayer/useConvexRoom.ts`
- Provider setup: `web/src/main.tsx`
