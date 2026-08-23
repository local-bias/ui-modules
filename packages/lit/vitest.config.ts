import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Lit のカスタム要素・Shadow DOM を動かすため DOM 実装が要る
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts', 'src/test-utils.ts'],
      reporter: ['text', 'html'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
