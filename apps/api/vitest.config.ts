import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/helpers/setupTestEnv.ts'],
    testTimeout: 10000,
    fileParallelism: false,
  },
});
