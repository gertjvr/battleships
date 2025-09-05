import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const root = __dirname;
  const repoRoot = path.resolve(root, '..');
  const engineSrc = path.resolve(repoRoot, 'engine/src/index.ts');
  const engineDist = path.resolve(repoRoot, 'engine/dist/index.js');

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        // Use source during dev for fast iteration; dist for production builds
        '@app/engine': command === 'build' ? engineDist : engineSrc,
        '@': path.resolve(root, 'src'),
        '@convex': path.resolve(root, 'convex'),
      },
    },
    server: {
      fs: {
        // allow importing from repo root (engine package)
        allow: [repoRoot],
      },
    },
  };
});
