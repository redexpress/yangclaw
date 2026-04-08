import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/pages/test',
  testMatch: '**/*.e2e.ts',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})