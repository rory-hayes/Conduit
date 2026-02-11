import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/shared/tests/**/*.test.ts',
      'services/worker/tests/**/*.test.ts',
      'apps/web/tests/**/*.test.tsx',
      'apps/web/tests/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'services/worker/src/**/*.ts',
        'packages/shared/src/**/*.ts',
        'apps/web/src/components/**/*.tsx',
        'apps/web/src/lib/**/*.ts'
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        'apps/web/src/app/**',
        'supabase/**'
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95
      }
    }
  }
});
