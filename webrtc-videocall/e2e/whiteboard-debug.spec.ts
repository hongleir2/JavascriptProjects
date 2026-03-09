import { test, expect, type Page } from '@playwright/test';

async function mockGetUserMedia(page: Page) {
  await page.addInitScript(() => {
    const createFakeStream = (constraints: MediaStreamConstraints) => {
      const tracks: MediaStreamTrack[] = [];
      if (constraints.audio) {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start();
        tracks.push(dest.stream.getAudioTracks()[0]);
      }
      if (constraints.video) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx2d = canvas.getContext('2d')!;
        ctx2d.fillStyle = '#00ff00';
        ctx2d.fillRect(0, 0, 640, 480);
        tracks.push(canvas.captureStream(30).getVideoTracks()[0]);
      }
      return new MediaStream(tracks);
    };
    navigator.mediaDevices.getUserMedia = async (constraints) =>
      createFakeStream(constraints || { audio: true, video: true });
    navigator.mediaDevices.getDisplayMedia = async () =>
      createFakeStream({ video: true });
  });
}

async function joinRoom(page: Page, roomId: string) {
  await page.goto('/');
  await page.getByPlaceholder('Enter Room ID').fill(roomId);
  await page.getByRole('button', { name: 'Join' }).click();
  await page.waitForSelector('[aria-label="Leave call"]', { timeout: 8000 });
}

test.describe('Whiteboard toolbar debug', () => {
  test('investigate toolbar click blocking', async ({ page }) => {
    // Collect all console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await mockGetUserMedia(page);
    await joinRoom(page, `wb-debug-${Date.now()}`);

    // Open whiteboard
    const wbButton = page.locator('button').filter({ has: page.locator('[data-testid="DashboardIcon"]') });
    await wbButton.click();

    // Wait for canvas
    const canvas = page.locator('canvas[aria-label="Drawing whiteboard canvas"]');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // Get DOM structure of the whiteboard container
    const containerInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas[aria-label="Drawing whiteboard canvas"]');
      if (!canvas) return 'Canvas not found';
      const container = canvas.parentElement;
      if (!container) return 'Container not found';

      const result: string[] = [];
      const children = Array.from(container.children);
      children.forEach((child, i) => {
        const computed = window.getComputedStyle(child);
        result.push(`Child ${i}: tag=${child.tagName} classes="${(child.className || '').toString().substring(0, 80)}" position=${computed.position} z-index=${computed.zIndex} pointer-events=${computed.pointerEvents}`);

        // If this is a div with buttons, list them
        if (child.tagName === 'DIV' && child.querySelectorAll('button').length > 0) {
          const buttons = child.querySelectorAll('button');
          buttons.forEach((btn, j) => {
            const label = btn.getAttribute('aria-label') || btn.textContent?.substring(0, 20) || '(no label)';
            result.push(`  -> Button ${j}: "${label}"`);
          });
        }
      });
      return result.join('\n');
    });
    console.log('=== Container DOM structure ===');
    console.log(containerInfo);

    // Check what element is at each toolbar button position
    const hitTestResults = await page.evaluate(() => {
      const canvas = document.querySelector('canvas[aria-label="Drawing whiteboard canvas"]');
      if (!canvas) return 'Canvas not found';
      const container = canvas.parentElement;
      if (!container) return 'Container not found';

      const buttons = container.querySelectorAll('button');
      const results: string[] = [];

      buttons.forEach((btn, i) => {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(centerX, centerY);
        const label = btn.getAttribute('aria-label') || btn.textContent?.substring(0, 20) || '(no label)';

        results.push(
          `Button "${label}": rect=(${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}) ` +
          `hitTest -> tag=${topElement?.tagName} aria-label="${topElement?.getAttribute('aria-label')}" ` +
          `sameElement=${topElement === btn || btn.contains(topElement!)}`
        );
      });

      return results.join('\n');
    });
    console.log('\n=== Hit test results (elementFromPoint at button centers) ===');
    console.log(hitTestResults);

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/wb-debug.png', fullPage: true });

    // Try clicking Rectangle button with force:true and check console logs
    console.log('\n=== Attempting to click Rectangle ===');

    // First find the toolbar Box (parent of buttons) via a more reliable selector
    const allToolbarButtons = page.locator('canvas[aria-label="Drawing whiteboard canvas"]').locator('..').locator('button');
    const tbCount = await allToolbarButtons.count();
    console.log(`Found ${tbCount} buttons in whiteboard container`);

    for (let i = 0; i < tbCount; i++) {
      const btn = allToolbarButtons.nth(i);
      const label = await btn.getAttribute('aria-label').catch(() => null);
      console.log(`  Button ${i}: aria-label="${label}"`);
    }

    // Print collected console logs from the page
    console.log('\n=== Page console logs ===');
    consoleLogs.forEach(log => console.log(log));
  });
});
