import { defineConfig, devices } from '@playwright/test';

const baseURL = (globalThis as any).process?.env?.['BASE_URL'] ?? 'http://localhost:5173';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    retries: 1,
    workers: 1,
    reporter: 'list',
    timeout: 30000,
    use: {
        baseURL,
        trace: 'on-first-retry',
        headless: true,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});