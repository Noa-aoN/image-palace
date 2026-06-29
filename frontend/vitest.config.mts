import { defineConfig } from 'vitest/config'

// Vitest 設定。`@/` エイリアスは Vite ネイティブの tsconfig paths 解決を使う。
// 既存の node:test（test/*.test.mjs）は include しない（.test.ts(x) のみ対象）。
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.{ts,tsx}'],
  },
})
