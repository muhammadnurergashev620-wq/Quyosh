import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'apps', 'TASK', '3-oy marcketplace'],
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 180_000,
    clearMocks: true,
    restoreMocks: true,
  },
});



