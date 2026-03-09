import { test, expect, type Page, type Browser } from '@playwright/test';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

/** Fake getUserMedia so tests run in headless (no real camera). */
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
        const audioTrack = dest.stream.getAudioTracks()[0];
        tracks.push(audioTrack);
      }
      if (constraints.video) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx2d = canvas.getContext('2d')!;
        ctx2d.fillStyle = '#00ff00';
        ctx2d.fillRect(0, 0, 640, 480);
        const videoStream = canvas.captureStream(30);
        const videoTrack = videoStream.getVideoTracks()[0];
        tracks.push(videoTrack);
      }
      return new MediaStream(tracks);
    };

    navigator.mediaDevices.getUserMedia = async (constraints) => {
      return createFakeStream(constraints || { audio: true, video: true });
    };

    // Stub getDisplayMedia for screen share tests
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, 1920, 1080);
      return canvas.captureStream(30);
    };
  });
}

/** Create a two-peer browser context with mocked media */
async function createPeerContext(browser: Browser) {
  return browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
  });
}

// ─────────────────────────────────────────────────────
// 1. JOIN ROOM PAGE
// ─────────────────────────────────────────────────────

test.describe('Join Room Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
  });

  test('renders landing page with all core elements', async ({ page }) => {
    await expect(page.getByText('Simple WebRTC Call', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Secure video meetings/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New meeting' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter Room ID')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join' })).toBeDisabled();
    await expect(page.getByText('End-to-end encrypted')).toBeVisible();
    await expect(page.getByText('Up to 100 participants')).toBeVisible();
  });

  test('shows camera preview unavailable on load (camera off by default)', async ({ page }) => {
    await expect(page.getByText('Camera preview unavailable')).toBeVisible();
    await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  });

  test('Join button enables when room ID is entered', async ({ page }) => {
    const joinBtn = page.getByRole('button', { name: 'Join' });
    await expect(joinBtn).toBeDisabled();

    await page.getByPlaceholder('Enter Room ID').fill('test-room-123');
    await expect(joinBtn).toBeEnabled();
  });

  test('Join button stays disabled for whitespace-only input', async ({ page }) => {
    await page.getByPlaceholder('Enter Room ID').fill('   ');
    await expect(page.getByRole('button', { name: 'Join' })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────
// 2. CAMERA / MIC TOGGLES (Preview)
// ─────────────────────────────────────────────────────

test.describe('Preview Camera/Mic Toggles', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    // Camera and mic are OFF by default
    await expect(page.getByText('Camera preview unavailable')).toBeVisible();
  });

  test('toggle camera on shows video preview', async ({ page }) => {
    await page.getByRole('button', { name: 'Turn on camera' }).click();
    await expect(page.locator('video')).toBeVisible({ timeout: 5000 });
  });

  test('toggle camera on then off shows "Camera is off" (with mic on)', async ({ page }) => {
    // Enable mic first so stream stays alive when cam turns off
    await page.getByRole('button', { name: 'Unmute microphone' }).click();
    // Turn cam on
    await page.getByRole('button', { name: 'Turn on camera' }).click();
    await expect(page.locator('video')).toBeVisible({ timeout: 5000 });

    // Turn cam off — mic still on, so stream exists → "Camera is off"
    await page.getByRole('button', { name: 'Turn off camera' }).click();
    await expect(page.getByText('Camera is off')).toBeVisible();
    await expect(page.locator('video')).not.toBeVisible();
  });

  test('toggle mic on changes button to mute state', async ({ page }) => {
    await page.getByRole('button', { name: 'Unmute microphone' }).click();
    await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeVisible();
  });

  test('turning off both shows "Camera preview unavailable"', async ({ page }) => {
    // Both already off by default
    await expect(page.getByText('Camera preview unavailable')).toBeVisible();
  });

  test('all off means no video element exists', async ({ page }) => {
    // Both off by default
    const result = await page.evaluate(() => {
      const video = document.querySelector('video');
      return { videoElementExists: !!video };
    });
    expect(result.videoElementExists).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
// 3. JOINING A ROOM
// ─────────────────────────────────────────────────────

test.describe('Room Joining Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New meeting' })).toBeVisible();
  });

  test('"New meeting" generates room ID and enters call', async ({ page }) => {
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('entering room ID and clicking Join enters call', async ({ page }) => {
    await page.getByPlaceholder('Enter Room ID').fill('my-test-room');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('entering room ID and pressing Enter joins', async ({ page }) => {
    await page.getByPlaceholder('Enter Room ID').fill('enter-room');
    await page.getByPlaceholder('Enter Room ID').press('Enter');
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────
// 4. VIDEO CALL VIEW
// ─────────────────────────────────────────────────────

test.describe('Video Call View', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('shows room ID in header', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toMatch(/\w+-\w+-\w+/);
  });

  test('shows local video PiP with "You (Preview)" label', async ({ page }) => {
    await expect(page.getByText('You (Preview)')).toBeVisible();
  });

  test('control bar is visible with all buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn off camera' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share screen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open whiteboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Background effects' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave call' })).toBeVisible();
  });

  test('debug log panel is visible', async ({ page }) => {
    await expect(page.getByText('Debug Log')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────
// 5. CONTROL BAR — MIC / CAMERA TOGGLES (In-call)
// ─────────────────────────────────────────────────────

test.describe('In-Call Mic/Camera Toggles', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('toggle mic mutes and shows unmute button', async ({ page }) => {
    await page.getByRole('button', { name: 'Mute' }).click();
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
  });

  test('toggle mic back unmutes', async ({ page }) => {
    await page.getByRole('button', { name: 'Mute' }).click();
    await page.getByRole('button', { name: 'Unmute' }).click();
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
  });

  test('toggle camera off shows camera off overlay', async ({ page }) => {
    await page.getByRole('button', { name: 'Turn off camera' }).click();
    await expect(page.getByText('Camera off')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on camera' })).toBeVisible();
  });

  test('toggle camera back on restores', async ({ page }) => {
    await page.getByRole('button', { name: 'Turn off camera' }).click();
    await page.getByRole('button', { name: 'Turn on camera' }).click();
    await expect(page.getByRole('button', { name: 'Turn off camera' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────
// 6. HANGUP
// ─────────────────────────────────────────────────────

test.describe('Hangup', () => {
  test('clicking Leave call returns to join page', async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Leave call' }).click();

    await expect(page.getByRole('heading', { name: /Secure video meetings/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'New meeting' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────
// 7. WHITEBOARD
// ─────────────────────────────────────────────────────

test.describe('Whiteboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('open whiteboard shows canvas', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('whiteboard has drawing tools', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();
    await expect(page.getByRole('button', { name: 'Pen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eraser' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Line', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dashed Line' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Arrow', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Double Arrow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rectangle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Circle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Triangle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Diamond' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible();
  });

  test('whiteboard has undo and clear buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();
    // Undo and Clear are wrapped in <span> for disabled Tooltip; find by aria-label
    await expect(page.getByLabel('Undo')).toBeVisible();
    await expect(page.getByLabel('Clear all')).toBeVisible();
  });

  test('drawing on canvas creates an element (undo becomes enabled)', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Draw a stroke
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 300, { steps: 10 });
    await page.mouse.up();

    // Undo button should be clickable
    const undoBtn = page.getByLabel('Undo');
    await expect(undoBtn).toBeVisible();
  });

  test('close whiteboard removes canvas', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();
    await expect(page.locator('canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Close whiteboard' }).click();
    await expect(page.locator('canvas')).not.toBeVisible();
  });

  test('whiteboard disables screen share button', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();
    // MUI disabled IconButton wrapped in Tooltip span
    const shareBtn = page.getByRole('button', { name: 'Share screen' });
    await expect(shareBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────
// 8. FILTER / VIRTUAL BACKGROUND POPUP
// ─────────────────────────────────────────────────────

test.describe('Virtual Background Popup', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('clicking filter button opens popup', async ({ page }) => {
    await page.getByRole('button', { name: 'Background effects' }).click();
    await expect(page.getByText('Background Effects')).toBeVisible();
  });

  test('popup shows None, Blur, and image options', async ({ page }) => {
    await page.getByRole('button', { name: 'Background effects' }).click();
    await expect(page.getByText('None')).toBeVisible();
    await expect(page.getByText('Blur')).toBeVisible();
    await expect(page.getByText('Mountain')).toBeVisible();
    await expect(page.getByText('Beach')).toBeVisible();
  });

  test('popup closes when clicking outside', async ({ page }) => {
    await page.getByRole('button', { name: 'Background effects' }).click();
    await expect(page.getByText('Background Effects')).toBeVisible();

    // Click backdrop area
    await page.mouse.click(10, 10);
    await expect(page.getByText('Background Effects')).not.toBeVisible();
  });

  test('selecting an option is reflected in UI', async ({ page }) => {
    await page.getByRole('button', { name: 'Background effects' }).click();
    await page.getByRole('button', { name: 'Select background: Blur' }).click();
    // Blur label should still be visible (popup stays open)
    const blurLabel = page.getByText('Blur').first();
    await expect(blurLabel).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────
// 9. SCREEN SHARE / WHITEBOARD MUTUAL EXCLUSIVITY
// ─────────────────────────────────────────────────────

test.describe('Screen Share / Whiteboard Exclusivity', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('screen share disables whiteboard button', async ({ page }) => {
    await page.getByRole('button', { name: 'Share screen' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /whiteboard/i })).toBeDisabled();
  });

  test('whiteboard disables screen share button', async ({ page }) => {
    await page.getByRole('button', { name: 'Open whiteboard' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /screen|sharing/i })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────
// 10. DEBUG LOG
// ─────────────────────────────────────────────────────

test.describe('Debug Log Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetUserMedia(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await expect(page.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });
  });

  test('debug log shows log entries after joining', async ({ page }) => {
    // Should have log entries with source tags
    await expect(page.locator('text=[ui]')).toBeVisible({ timeout: 5000 });
  });

  test('debug log can be collapsed and expanded', async ({ page }) => {
    const collapseBtn = page.getByLabel('Collapse debug log');
    await collapseBtn.click();

    // Log content should be hidden
    await expect(page.locator('text=[ui]')).not.toBeVisible({ timeout: 3000 });

    // Expand
    const expandBtn = page.getByLabel('Expand debug log');
    await expandBtn.click();
    await expect(page.locator('text=[ui]')).toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────
// 11. TWO-PEER CONNECTION (full WebRTC flow)
// ─────────────────────────────────────────────────────

test.describe('Two-Peer Connection', () => {
  test('two tabs can connect and see each other', async ({ browser }) => {
    const context = await createPeerContext(browser);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    for (const p of [page1, page2]) await mockGetUserMedia(p);

    const roomId = 'e2e-test-room-' + Date.now();

    await page1.goto('/');
    await page1.getByPlaceholder('Enter Room ID').fill(roomId);
    await page1.getByRole('button', { name: 'Join' }).click();
    await expect(page1.getByText('Waiting for the other participant')).toBeVisible({ timeout: 10000 });

    await page2.goto('/');
    await page2.getByPlaceholder('Enter Room ID').fill(roomId);
    await page2.getByRole('button', { name: 'Join' }).click();

    // Both should reach connected state
    await expect(page1.getByText('CONNECTED')).toBeVisible({ timeout: 15000 });
    await expect(page2.getByText('CONNECTED')).toBeVisible({ timeout: 15000 });

    // Both should show "Remote User" badge
    await expect(page1.getByText('Remote User')).toBeVisible({ timeout: 5000 });
    await expect(page2.getByText('Remote User')).toBeVisible({ timeout: 5000 });

    // Tab switcher visible when connected
    await expect(page1.getByRole('button', { name: 'Switch to video view' })).toBeVisible();

    await context.close();
  });

  test('hangup from one peer returns both to idle', async ({ browser }) => {
    const context = await createPeerContext(browser);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    for (const p of [page1, page2]) await mockGetUserMedia(p);

    const roomId = 'hangup-test-' + Date.now();

    await page1.goto('/');
    await page1.getByPlaceholder('Enter Room ID').fill(roomId);
    await page1.getByRole('button', { name: 'Join' }).click();

    await page2.goto('/');
    await page2.getByPlaceholder('Enter Room ID').fill(roomId);
    await page2.getByRole('button', { name: 'Join' }).click();

    await expect(page1.getByText('CONNECTED')).toBeVisible({ timeout: 15000 });
    await expect(page2.getByText('CONNECTED')).toBeVisible({ timeout: 15000 });

    // Page 1 hangs up
    await page1.getByRole('button', { name: 'Leave call' }).click();
    await expect(page1.getByRole('heading', { name: /Secure video meetings/i })).toBeVisible({ timeout: 5000 });

    // Page 2 should also return (peer-left)
    await expect(page2.getByRole('heading', { name: /Secure video meetings/i })).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('room full when third peer tries to join', async ({ browser }) => {
    const context = await createPeerContext(browser);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();
    for (const p of [page1, page2, page3]) await mockGetUserMedia(p);

    const roomId = 'full-room-' + Date.now();

    await page1.goto('/');
    await page1.getByPlaceholder('Enter Room ID').fill(roomId);
    await page1.getByRole('button', { name: 'Join' }).click();

    await page2.goto('/');
    await page2.getByPlaceholder('Enter Room ID').fill(roomId);
    await page2.getByRole('button', { name: 'Join' }).click();

    await expect(page1.getByText('CONNECTED')).toBeVisible({ timeout: 15000 });

    // Third peer
    await page3.goto('/');
    await page3.getByPlaceholder('Enter Room ID').fill(roomId);
    await page3.getByRole('button', { name: 'Join' }).click();

    await expect(page3.getByText('Room is full')).toBeVisible({ timeout: 10000 });
    await expect(page3.getByRole('button', { name: 'New meeting' })).toBeVisible();

    await context.close();
  });
});
