import { test, expect } from '@playwright/test';

test.describe('Meoww Landing Page', () => {
  test('EN page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto('http://localhost:4321/en/');
    await expect(page).toHaveTitle(/Meoww/);
    await expect(page.locator('h1')).toContainText('Meoww');
    expect(errors).toHaveLength(0);
  });

  test('zh-TW page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto('http://localhost:4321/zh-TW/');
    await expect(page).toHaveTitle(/Meoww/);
    await expect(page.locator('h1')).toContainText('Meoww');
    expect(errors).toHaveLength(0);
  });

  test('Invite button has correct href', async ({ page }) => {
    await page.goto('http://localhost:4321/en/');
    const inviteBtn = page.locator('a[href*="discord.com/oauth2"]').first();
    await expect(inviteBtn).toHaveAttribute('href', /506843065424543745/);
  });

  test('Dark mode is default', async ({ page }) => {
    await page.goto('http://localhost:4321/en/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('Theme toggle works', async ({ page }) => {
    await page.goto('http://localhost:4321/en/');
    
    // Click theme toggle
    await page.click('#theme-toggle');
    
    // Should now be light mode
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
    
    // Click again
    await page.click('#theme-toggle');
    
    // Should be dark again
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});