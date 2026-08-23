import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    retries: 1,
    workers: 1,
    reporter: 'list',
    timeout: 30000,
    use: {
        baseURL: 'https://effective-goldfish-6v7jx659x7xf5rpq-5173.app.github.dev',
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