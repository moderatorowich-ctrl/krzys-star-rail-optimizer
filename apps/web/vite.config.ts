import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryName = process.env.VITE_REPOSITORY_NAME ?? 'krzys-star-rail-optimizer';

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: command === 'serve' ? '/' : `/${repositoryName}/`,
  plugins: [react()],
  resolve: {
    alias: {
      '@ksro/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@ksro/game-data': fileURLToPath(
        new URL('../../packages/game-data/src/index.ts', import.meta.url),
      ),
      '@ksro/optimizer-engine': fileURLToPath(
        new URL('../../packages/optimizer-engine/src/index.ts', import.meta.url),
      ),
      '@ksro/combat-engine': fileURLToPath(
        new URL('../../packages/combat-engine/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('\\node_modules\\react'))
            return 'react';
          if (id.includes('/node_modules/zod') || id.includes('\\node_modules\\zod'))
            return 'validation';
          if (
            id.includes('/node_modules/lucide-react') ||
            id.includes('\\node_modules\\lucide-react')
          )
            return 'icons';
        },
      },
    },
  },
}));
