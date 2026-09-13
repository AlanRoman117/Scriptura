import { expect, test } from '@playwright/test';

/**
 * Operating the reader without a pointer.
 *
 * axe can tell you a control has no name; it cannot tell you that Tab reached
 * it with no visible ring, that Escape closed the wrong thing, or that focus
 * fell to <body> when a panel went away. Those are the failures a keyboard
 * user actually hits, and they are proved here by pressing the keys.
 *
 * Focus-visible is measured, not assumed: the ring used to be declared with
 * `:where()`, whose zero specificity lost to five later `outline: none`
 * rules, so the writing surface had a focus rule and no focus ring for a year.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

interface Stop {
  tag: string;
  id: string;
  outlineStyle: string;
  outlineWidth: number;
  focusVisible: boolean;
}

/** What has focus, and whether it shows it. */
const focused = (page: import('@playwright/test').Page): Promise<Stop> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.dataset.testid ?? el.getAttribute('aria-label') ?? el.className,
      outlineStyle: s.outlineStyle,
      outlineWidth: parseFloat(s.outlineWidth),
      focusVisible: el.matches(':focus-visible'),
    };
  });

test.describe('every stop shows the ring', () => {
  test('tabbing through the reading state', async ({ page }) => {
    await open(page);
    const seen: Stop[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const stop = await focused(page);
      if (stop.tag === 'body') break;
      seen.push(stop);
    }
    // A sanity floor: the bar, the search box, and a run of verse numbers.
    expect(seen.length).toBeGreaterThan(10);
    for (const stop of seen) {
      expect.soft(stop.focusVisible, `${stop.tag} ${stop.id} should match :focus-visible`).toBe(true);
      expect.soft(stop.outlineStyle, `${stop.tag} ${stop.id} outline-style`).not.toBe('none');
      expect.soft(stop.outlineWidth, `${stop.tag} ${stop.id} outline-width`).toBeGreaterThanOrEqual(2);
    }
  });

  test('the writing surface and the note title', async ({ page }) => {
    // These two carried `outline: none` — the one place a reader spends the
    // most time was the one place with no focus indicator.
    await open(page);
    await page.getByTestId('note-new').click();
    for (const id of ['note-title', 'notes-surface']) {
      await page.getByTestId(id).focus();
      // A programmatic focus does not always count as focus-visible; a key does.
      await page.keyboard.press('Shift');
      const stop = await focused(page);
      expect(stop.id).toBe(id);
      expect(stop.outlineStyle).not.toBe('none');
      expect(stop.outlineWidth).toBeGreaterThanOrEqual(2);
    }
  });

  test('the collection labels in Marks', async ({ page }) => {
    await open(page);
    await page.getByTestId('marks-open').click();
    await page.getByTestId('marks-label-amber').focus();
    await page.keyboard.press('Shift');
    const stop = await focused(page);
    expect(stop.id).toBe('marks-label-amber');
    expect(stop.outlineStyle).not.toBe('none');
  });
});

/** Stand in for the browser's WebMCP, so a proposal can be raised (copied from webmcp.spec.ts). */
async function installMockContext(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const registry = new Map<string, unknown>();
    (document as unknown as { modelContext: unknown }).modelContext = {
      async registerTool(tool: { name: string }) {
        registry.set(tool.name, tool);
      },
      async getTools() {
        return [...registry.values()];
      },
    };
  });
}

const activeTestId = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? document.activeElement?.tagName);

test.describe('closing gives focus back', () => {
  for (const [chip, panel] of [
    ['marks-open', 'marks-panel'],
    ['library-open', 'library-panel'],
    ['settings-open', 'settings-panel'],
  ] as const) {
    test(`${panel}: Escape closes it and focus returns to ${chip}`, async ({ page }) => {
      await open(page);
      await page.getByTestId(chip).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(panel)).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByTestId(panel)).toHaveCount(0);
      await expect.poll(() => activeTestId(page)).toBe(chip);
    });
  }

  test('the verse actions: Escape closes them and the verse number has focus again', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-2').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verse[data-verse="2"]')).toHaveAttribute('data-open', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.verse[data-verse="2"]')).not.toHaveAttribute('data-open', /./);
    await expect.poll(() => activeTestId(page)).toBe('verse-2');
  });

  test('a press outside the verse closes its actions; a press on another verse moves them', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-2').click();
    await expect(page.locator('.verse[data-verse="2"]')).toHaveAttribute('data-open', 'true');
    await page.getByTestId('chapter-title').click();
    await expect(page.locator('.verse[data-verse="2"]')).not.toHaveAttribute('data-open', /./);

    await page.getByTestId('verse-3').click();
    await expect(page.locator('.verse[data-verse="3"]')).toHaveAttribute('data-open', 'true');
    await page.locator('.verse[data-verse="4"] .verse__text').click();
    await expect(page.locator('.verse[data-verse="3"]')).not.toHaveAttribute('data-open', /./);
    await expect(page.locator('.verse[data-verse="4"]')).toHaveAttribute('data-open', 'true');
  });

  test('Escape closes only the surface that opened last', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-open', 'true');

    await page.getByTestId('search-input').fill('love');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'love');
    await expect(page.getByTestId('search-panel')).toBeVisible();

    // Newest first: the search suggestions go, the verse actions stay.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('search-panel')).toBeHidden();
    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-open', 'true');

    await page.keyboard.press('Escape');
    await expect(page.locator('.verse[data-verse="1"]')).not.toHaveAttribute('data-open', /./);
  });
});

test.describe('the proposal is a real modal', () => {
  test('Tab stays inside, Escape discards, and focus returns to where it was', async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await page.getByTestId('settings-open').click();
    await page.getByTestId('agent-toggle').check();
    await page.getByTestId('settings-close').click();
    // Closing Settings returned focus to its chip; that is where the dialog
    // must send focus back to afterwards.
    await expect.poll(() => activeTestId(page)).toBe('settings-open');

    await page.evaluate(async () => {
      const tool = window.scripturaAgent!.tools().find((t) => t.name === 'scriptura_propose_note')!;
      await tool.execute({ title: 'Draft', body: 'A thought.' });
    });
    const dialog = page.getByTestId('proposal');
    await expect(dialog).toBeVisible();
    // The dialog itself has focus first, so its title and lede are read.
    expect(await activeTestId(page)).toBe('proposal');

    // A modal dialog makes the page behind it inert. Tab may still leave for
    // the browser's own UI (Chromium reports that as focus on <body>), which
    // is allowed; what may never happen is focus on a page element outside
    // the dialog.
    const visited = new Set<string>();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return 'body';
        return el.closest('[data-testid="proposal"]') ? `in:${el.dataset.testid ?? el.tagName}` : `out:${el.dataset.testid ?? el.tagName}`;
      });
      expect(where.startsWith('out:'), where).toBe(false);
      if (where.startsWith('in:')) visited.add(where);
    }
    // Title, body, Discard, Save: all reachable.
    expect(visited.size).toBeGreaterThanOrEqual(4);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => activeTestId(page)).toBe('settings-open');
  });
});
