import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [['client/test/**', 'jsdom']],
    setupFiles: ['./client/test/setup.ts'],
    include: ['server/test/**/*.test.ts', 'client/test/**/*.test.tsx'],
    coverage: { reporter: ['text', 'html'] }
  }
});
