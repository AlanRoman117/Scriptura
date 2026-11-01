import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';
import { styleTile } from '../helpers/styles';

/**
 * A board drawn in a note fits every label to its card against a real
 * measurement, and each measurement forces a layout of the page. It did that on
 * every render, so typing beside a 500-card board forced 500 layouts a key. The
 * widths are remembered now, which is only safe if nothing the widths depend on
 * can change behind them: a stale width is a clipped or spilling label, and that
 * is worse than the cost it saves. So the tests here are of two kinds: that the
 * layouts stay gone, and that every change of font lands where a fresh load does.
 */

const CARDS = 60;

const LONG = 'A thought long enough that a card of this size has to cut it short';

function makeBoard(id: string, cards: number, across: number, title: (i: number) => string) {
  const nodes = Array.from({ length: cards }, (_, i) => ({
    id: `t${i}`,
    kind: 'text',
    x: 40 + (i % across) * 304,
    y: 40 + Math.floor(i / across) * 204,
    title: title(i),
    text: '',
  }));
  return { id, name: id, nodes, edges: [], created: 1, updated: 1 };
}

const fence = (id: string) => `\`\`\`scriptura-board\n${id}\n\`\`\``;

/** Open the reader on one note holding these boards, as a later visit finds them. */
async function seed(page: Page, boards: ReturnType<typeof makeBoard>[]) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  const note = {
    id: 'note-1',
    title: 'Embeds a board',
    body: `Some text before the board.\n\n${boards.map((b) => fence(b.id)).join('\n\n')}\n\nSome text after it.`,
    created: 1,
    updated: 1,
  };
  await page.evaluate(
    async ({ boards, note }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['boards', 'notes'], 'readwrite');
        for (const b of boards) tx.objectStore('boards').put(b, b.id);
        tx.objectStore('notes').clear();
        tx.objectStore('notes').put(note, note.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { boards, note }
  );
  await freshLoad(page, boards[0].id);
}

async function freshLoad(page: Page, boardId: string) {
  await page.reload();
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`board-embed-${boardId}`)).toBeVisible();
}

const labelsOf = (page: Page, boardId = 'big'): Promise<string[]> =>
  page
    .getByTestId(`board-embed-${boardId}`)
    .locator('text.embed__label')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));

/** The labels drawn wider than the box leaves them room for; should be none. */
const spills = (page: Page, boardId = 'big'): Promise<string[]> =>
  page
    .getByTestId(`board-embed-${boardId}`)
    .locator('text.embed__label')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const box = el.previousElementSibling as SVGRectElement;
          const pad = 6;
          return (el as SVGTextElement).getComputedTextLength() > box.width.baseVal.value - pad * 2 + 0.01;
        })
        .map((el) => el.textContent ?? '')
    );

/** Reloads, and expects the very labels that were on the page before it. */
async function expectSameAfterFreshLoad(page: Page, boardId = 'big') {
  const drawn = await labelsOf(page, boardId);
  expect(await spills(page, boardId)).toEqual([]);
  await freshLoad(page, boardId);
  expect(await labelsOf(page, boardId)).toEqual(drawn);
}

/** Count every measurement a page makes, from before its scripts run. */
const countMeasures = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __measures: number };
    w.__measures = 0;
    const proto = SVGTextContentElement.prototype;
    const real = proto.getComputedTextLength;
    proto.getComputedTextLength = function () {
      w.__measures += 1;
      return real.call(this);
    };
  });

const measures = (page: Page) => page.evaluate(() => (window as unknown as { __measures: number }).__measures);

async function typeInNote(page: Page, text: string) {
  await page.getByTestId('notes-surface').click({ position: { x: 20, y: 10 } });
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

async function layoutCount(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'LayoutCount')?.value ?? 0;
}

async function inSettings(page: Page, change: () => Promise<void>) {
  await page.getByTestId('settings-open').click();
  await change();
  await page.getByTestId('settings-close').click();
}

/**
 * A rule the page has from before its first render, on every load. Adopted, so
 * it needs no document to attach to yet and comes after the app's stylesheet.
 */
const withStyle = (page: Page, css: string) =>
  page.addInitScript((rules) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(rules);
    document.adoptedStyleSheets = [sheet];
  }, css);

const big = () => makeBoard('big', CARDS, 8, (i) => `${LONG} ${i}`);

test.describe('a keystroke beside an embedded board', () => {
  test('forces no layout per card', async ({ page }) => {
    await seed(page, [big()]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

    const text = ' and twenty letters!';
    const before = await layoutCount(cdp);
    await typeInNote(page, text);
    await expect.poll(() => page.getByTestId('notes-surface').evaluate((el) => (el as HTMLTextAreaElement).value)).toContain(text);
    const layouts = (await layoutCount(cdp)) - before;

    // A layout per card per key is the least it cost before, and these long titles
    // cost far more (measured: 57,421 for these 20 keys, against a few dozen with
    // the widths remembered). A quarter of a card per key leaves a slow machine
    // plenty of room, and none for the old cost.
    expect(layouts).toBeLessThan((text.length * CARDS) / 4);
  });

  test('measures nothing it has already measured', async ({ page }) => {
    await countMeasures(page);
    await seed(page, [big()]);
    const before = await measures(page);
    expect(before).toBeGreaterThanOrEqual(CARDS);

    await typeInNote(page, ' and a few more words');
    await expect(page.getByTestId('notes-surface')).toContainText('and a few more words');

    expect(await measures(page)).toBe(before);
  });
});

test.describe('what the measurement depends on', () => {
  test('text size, spacing, style and zoom each measure again', async ({ page }) => {
    await countMeasures(page);
    await seed(page, [big()]);

    const remeasured = async (change: () => Promise<void>) => {
      const before = await measures(page);
      await change();
      await expect.poll(async () => (await measures(page)) - before).toBeGreaterThanOrEqual(CARDS);
    };

    await remeasured(() => inSettings(page, () => page.getByTestId('pref-text-size').selectOption('150')));
    await expectSameAfterFreshLoad(page);

    await remeasured(() => inSettings(page, () => page.getByTestId('pref-spacing').selectOption('loose')));
    await expectSameAfterFreshLoad(page);

    await remeasured(() => inSettings(page, () => styleTile(page, 'vellum').click()));
    await expectSameAfterFreshLoad(page);

    // Zoom changes no setting; the next thing to draw has to see it.
    const cdp = await page.context().newCDPSession(page);
    await remeasured(async () => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false });
      await typeInNote(page, ' x');
    });
  });

  /**
   * In the shipped stylesheet a label is 10px of `--sans` whatever Settings say,
   * so a stale width would pass unseen. These rules tie the label to each setting
   * in turn, which is the test: the words on the card have to change, in the page
   * already open, to what a fresh load draws.
   */
  test('a change of font lands where a fresh load does', async ({ page }) => {
    await withStyle(
      page,
      `
        .embed__label { font-size: calc(7px * var(--text-scale) * var(--reading-leading)); }
        :root[data-style='vellum'] .embed__label { letter-spacing: 1px; }
        :lang(ja) .embed__label { word-spacing: 6px; letter-spacing: 2px; }
      `
    );
    await seed(page, [big()]);

    const changesLabels = async (change: () => Promise<void>) => {
      const before = await labelsOf(page);
      await change();
      await expect.poll(() => labelsOf(page)).not.toEqual(before);
      await expectSameAfterFreshLoad(page);
    };

    await changesLabels(() => inSettings(page, () => page.getByTestId('pref-text-size').selectOption('125')));
    await changesLabels(() => inSettings(page, () => page.getByTestId('pref-spacing').selectOption('loose')));
    await changesLabels(() => inSettings(page, () => styleTile(page, 'vellum').click()));
    await changesLabels(() => inSettings(page, () => page.getByTestId('pref-language').selectOption('ja-JP')));
  });

  test('a change made while the thumbnail is hidden is there when it comes back', async ({ page }) => {
    await withStyle(page, `:root[data-style='vellum'] .embed__label { letter-spacing: 1px; }`);
    await seed(page, [big()]);
    const before = await labelsOf(page);

    await page.getByTestId('side-board').click();
    await inSettings(page, () => styleTile(page, 'vellum').click());
    await page.getByTestId('side-notes').click();

    await expect(page.getByTestId('board-embed-big')).toBeVisible();
    await expect.poll(() => labelsOf(page)).not.toEqual(before);
    await expectSameAfterFreshLoad(page);
  });

  /** One character 1.4em wide, whatever the character: late, it changes every width. */
  const WIDE_FONT =
    'AAEAAAAKAIAAAwAgT1MvMkUAR5IAAAEoAAAAYGNtYXAAXwG+AAABkAAAAPJnbHlmSdEnWwAAAowAAAAaaGVhZDJ28fIAAACsAAAANmhoZWEIaAUWAAAA5AAAACRobXR4BaoAAAAAAYgAAAAGbG9jYQANAAAAAAKEAAAABm1heHAABAAGAAABCAAAACBuYW1lTz1qZgAAAqgAAABXcG9zdHB+A2IAAAMAAAAAKgABAAAAAQAAhozuJl8PPPUAAwPoAAAAAOcNVysAAAAA5w1XKwAyAAAFFAK8AAAAAwACAAAAAAAAAAEAAAMg/zgAAAV4ADIAZAUUAAEAAAAAAAAAAAAAAAAAAAABAAEAAAACAAQAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwV4AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAPz8/PwAAACAAfgMg/zgAAAMgAMgAAAAAAAAAAAAAAAAAAAAgAAAFeAAAADIAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQA3gAAAAQABAABAAAAfv//AAAAIP//AAAAAQAEAAAAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAA0AAAABADIAAAUUArwAAwAAMxEhETIE4gK8/UQAAAAAAAAEADYAAQAAAAAAAQAEAAAAAQAAAAAAAgAHAAQAAwABBAkAAQAIAAsAAwABBAkAAgAOABNMYXRlUmVndWxhcgBMAGEAdABlAFIAZQBnAHUAbABhAHIAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAQIDYm94AAA=';

  test('a font that finishes loading late fits the labels again, with nothing else happening', async ({ page }) => {
    await withStyle(page, `.embed__label { font-family: 'LateWide', sans-serif; }`);
    await seed(page, [big()]);
    const fallback = await labelsOf(page);

    const load = (data: string) => {
      const face = new FontFace('LateWide', `url(data:font/ttf;base64,${data})`);
      document.fonts.add(face);
      return face.load().then(() => undefined);
    };
    await page.evaluate(load, WIDE_FONT);

    // The family's name has not changed, so no computed value says anything did.
    await expect.poll(() => labelsOf(page)).not.toEqual(fallback);
    const late = await labelsOf(page);
    expect(await spills(page)).toEqual([]);

    // A visit that has the font from the start.
    await page.addInitScript(load, WIDE_FONT);
    await freshLoad(page, 'big');
    await expect.poll(() => labelsOf(page)).toEqual(late);
  });

  test('one string is cut to the room in each box, not to the first it was measured for', async ({ page }) => {
    // Same title, drawn at two scales: the wide board shrinks, the small one does not.
    const small = makeBoard('small', 2, 2, () => LONG);
    const wide = makeBoard('wide', 8, 8, () => LONG);
    await seed(page, [small, wide]);

    const [atFull] = await labelsOf(page, 'small');
    const [shrunk] = await labelsOf(page, 'wide');
    expect(shrunk.length).toBeLessThan(atFull.length);
    expect(await spills(page, 'small')).toEqual([]);
    expect(await spills(page, 'wide')).toEqual([]);
  });
});
