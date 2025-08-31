# Battleships

Monorepo for a Battleships game with a TypeScript game engine and a React + Vite web UI. The web app depends on the engine via the `@app/engine` workspace package.

## Project Structure

```
engine/   # TypeScript game engine (pure functions)
  src/    # source
  dist/   # build output
web/      # React + Vite UI
  src/    # UI source (components/, views/)
  index.html
  src/index.css
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

Run the web app in development (Vite dev server):

```bash
pnpm dev
```

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
