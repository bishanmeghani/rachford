import { defineConfig, devices } from '@playwright/test';

const baseURL = (globalThis as any).process?.env?.['BASE_URL'] ?? 'https://effective-goldfish-6v7jx659x7xf5rpq-5173.app.github.dev';

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