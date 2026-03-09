import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'node server.js',
      port: 8080,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite --host',
      url: 'https://localhost:5173',
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
    },
  ],
});
