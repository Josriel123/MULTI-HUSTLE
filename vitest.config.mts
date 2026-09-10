import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the pure tax engine (src/lib/tax). No database, no network.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
