# Repository Guidelines

## Project Structure & Module Organization
- `engine/`: TypeScript game engine (pure functions). Source in `engine/src/`, build output in `engine/dist/`.
- `web/`: React + Vite UI. Source in `web/src/`, entry `web/index.html`, styles in `web/src/index.css`.
- Workspace managed with `pnpm` (`package.json` + `pnpm-workspace.yaml`). The web app depends on the engine via `@app/engine`.

## Build, Test, and Development Commands
- `pnpm install`: Install workspace deps.
- `pnpm dev`: Run the Vite dev server for `web/`.
- `pnpm -C engine build`: Type-check and emit engine to `dist/`.
- `pnpm -C web build`: Build the web app (Vite) to `web/dist/`.
- `pnpm build`: Build engine then web (root convenience script).
- `pnpm preview`: Preview the built web app locally.

## Coding Style & Naming Conventions
- Language: TypeScript (strict, ES modules). React function components.
- Indentation: 2 spaces; use semicolons; prefer single quotes.
- React components: `PascalCase` filenames (e.g., `App.tsx`); variables/functions `camelCase`.
- Engine: named exports, pure functions, no side effects; keep data immutable.
- Keep modules small and focused; colocate UI components under `web/src/components/` and views under `web/src/views/`.

## Testing Guidelines
- Frameworks are not set up yet. Preferred approach:
  - Engine: Vitest unit tests in `engine/src/*.test.ts`.
  - Web: Vitest + React Testing Library in `web/src/**/*.test.tsx`.
- Aim for clear, small tests around game rules and UI interactions. Add `test` scripts when introducing tests (e.g., `pnpm -C engine test`).

## Commit & Pull Request Guidelines
- Commits: Imperative present tense ("add engine fire logic"); group related changes; small and scoped. Conventional Commits are welcome (e.g., `feat(web): highlight last shot`).
- PRs: Provide a concise description, motivation, and testing steps. Link issues. For UI changes, include screenshots/GIFs. Ensure `pnpm build` passes and the app runs via `pnpm preview`.

## Security & Configuration Tips
- Client-only app; do not commit secrets. If environment variables are added, use Vite `VITE_`-prefixed vars and document them.
- Keep third-party additions minimal; prefer small, well-maintained deps.

## Agent Tools
- Serena (code): Use to locate symbols and navigate code quickly. Examples: find a function by name (`find_symbol name_path:"placeShip" within engine/src`), get file overviews (`get_symbols_overview web/src/App.tsx`), and search by pattern for usages (e.g., `coordsFor`). Prefer symbol-based queries over raw text.
- Context7 (docs): Resolve the library, then fetch focused docs. Example: `resolve-library-id "vite"` ➜ `get-library-docs id topic:"build"`. Useful for Vite config, React 18 APIs, and TypeScript compiler options.
- Sequential-thinking (planning): For multi-step tasks, write short thoughts by stage (Problem Definition → Research → Analysis → Synthesis → Conclusion). Keep each thought actionable; update the next step as you learn.
