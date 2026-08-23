import { test, expect } from '@playwright/test';

async function navigateTo(page: any, path: string = '/') {
    await page.goto(path);
    // Handle GitHub Codespaces warning page
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    }
}

test('app loads correctly', async ({ page }) => {
    await navigateTo(page);
    await expect(page.locator('text=EXPLORER')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=UNIT OPS')).toBeVisible();
    await expect(page.locator('text=MESSAGES')).toBeVisible();
});

test('File menu opens', async ({ page }) => {
    await navigateTo(page);
    await page.click('text=File');
    await expect(page.locator('text=New')).toBeVisible();
    await expect(page.getByText('Save', { exact: true })).toBeVisible();
    await expect(page.locator('text=Open')).toBeVisible();
});

test('Explorer shows components', async ({ page }) => {
    await navigateTo(page);
    await expect(page.locator('text=COMPONENTS')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Water')).toBeVisible();
    await expect(page.locator('text=Ethanol')).toBeVisible();
});

test('Tools menu opens Units Settings modal', async ({ page }) => {
    await navigateTo(page);
    await page.click('text=Tools');
    await page.click('text=Units Settings');
    await expect(page.locator('text=Molar Flow')).toBeVisible();
});