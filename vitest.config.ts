import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts', 'shared/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['electron/tax-service.ts', 'electron/tax-engine.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
});
