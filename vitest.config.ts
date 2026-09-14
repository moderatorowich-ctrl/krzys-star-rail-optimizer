import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@ksro/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@ksro/game-data': fileURLToPath(
        new URL('./packages/game-data/src/index.ts', import.meta.url),
      ),
      '@ksro/optimizer-engine': fileURLToPath(
        new URL('./packages/optimizer-engine/src/index.ts', import.meta.url),
      ),
      '@ksro/combat-engine': fileURLToPath(
        new URL('./packages/combat-engine/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
