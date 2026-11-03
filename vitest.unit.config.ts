import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Infratuzilmasiz (DB/Redis/MinIO/ClamAV kerak emas) unit testlar: `pnpm test:unit`. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'tests/unit/**/*.spec.ts'],
    setupFiles: ['reflect-metadata'],
    testTimeout: 30_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
