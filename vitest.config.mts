import { defineConfig } from 'vitest/config';

// Unit tests for the pure tax engine (src/lib/tax). No database, no network.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
