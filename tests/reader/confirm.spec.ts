import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The question asked before anything is deleted (3.3.4, 3.3.6).
 *
 * A manual review found that a tap on Delete gave no clear sign that
 * something was about to be deleted: the button only turned into "Sure?"
 * where it stood. A modal replaced it. What is proved here is what it says,
 * where focus goes on the way in and on the way out (2.4.3), that it waits
 * (2.2.3), and that it speaks each interface language.
 *
 * The same review found that "Start one" did nothing on the board screen
 * when pressed with a pointer, so the empty states are here too.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const dialog = (page: Page) => page.getByTestId('confirm-dialog');

async function mark(page: Page, verse: number, color: string) {
  await page.locator(`.verse[data-verse="${verse}"]`).click();
  await page.getByTestId(`swatch-${color}`).click();
  await expect(page.locator(`.verse[data-verse="${verse}"]`)).toHaveAttribute('data-highlight', color);
}

test.describe('the confirmation dialog', () => {
  test('is a modal alert dialog, named by its question and described by what happens', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('Sermon notes');
    const trigger = page.getByTestId('note-delete');
    // Said before the press: a dialog follows.
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger.click();

    const box = page.getByRole('alertdialog', { name: 'Delete the note “Sermon notes”?' });
    await expect(box).toBeVisible();
    await expect(box).toHaveAccessibleDescription(
      /deleted from this device\.\s*You cannot undo this\.\s*To keep a copy, export your notes first\./
    );
    expect(await dialog(page).evaluate((el) => el.matches(':modal'))).toBe(true);

    // Focus starts on the answer that loses nothing; Tab reaches the other.
    await expect(page.getByTestId('confirm-cancel')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('confirm-accept')).toBeFocused();
    // Each button's name is its visible words (2.5.3).
    await expect(page.getByTestId('confirm-cancel')).toHaveAccessibleName('Cancel');
    await expect(page.getByTestId('confirm-accept')).toHaveAccessibleName('Delete note');
    // Tab does not leave the dialog for the page behind it.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="pane-notes"], [data-testid="pane-bible"]'))).toBe(false);

    // Nor can the page behind it be pressed.
    await expect(page.getByTestId('note-new').click({ trial: true, timeout: 1_000 })).rejects.toThrow();

    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('note-title')).toHaveValue('Sermon notes');
  });

  test('waits for an answer, however long that takes (2.2.3)', async ({ page }) => {
    await page.clock.install();
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-delete').click();
    await expect(dialog(page)).toBeVisible();
    await page.clock.fastForward('05:00');
    await expect(dialog(page)).toBeVisible();
    await page.getByTestId('confirm-cancel').click();
    await expect(dialog(page)).toBeHidden();
  });

  test('Escape answers the dialog alone: the panel beneath stays open', async ({ page }) => {
    await open(page);
    await mark(page, 2, 'mint');
    await page.getByTestId('marks-open').click();
    const remove = page.getByTestId('marks-remove-john-1-2');
    await remove.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId('marks-panel')).toBeVisible();
    await expect(remove).toBeFocused();
    await expect(page.getByTestId('marks-count-mint')).toHaveText('1');
  });

  test('a question answered with Escape can be asked again at once', async ({ page }) => {
    // Escape closes the dialog a task before its `close` event arrives. A
    // Delete pressed in between once found the old question still pending,
    // and did nothing.
    await open(page);
    for (const verse of [1, 3]) {
      await page.getByTestId(`verse-${verse}`).click();
      await page.getByTestId(`canvas-${verse}`).click();
    }
    await page.getByTestId('canvas-open').click();
    await page.locator('.card').first().focus();
    for (let round = 0; round < 3; round++) {
      await page.keyboard.press('Delete');
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('Delete');
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByTestId('confirm-cancel')).toBeFocused();
  });

  test('a press that starts in the box and ends outside it is not a Cancel', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-delete').click();
    const title = (await page.getByTestId('confirm-title').boundingBox())!;
    await page.mouse.move(title.x + 20, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(4, 4, { steps: 4 });
    await page.mouse.up();
    await expect(dialog(page)).toBeVisible();
  });
});

test.describe('after a confirmed removal, focus lands where the removed thing was (2.4.3)', () => {
  test('a note: on the picker, then on "Start one" once none are left', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('First');
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('Second');

    await page.getByTestId('note-delete').click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('note-select')).toBeFocused();
    await expect(page.getByTestId('note-select')).toHaveValue(/.+/);
    await expect(page.getByTestId('note-title')).toHaveValue('First');
    // Said after focus has landed, so the new place is read first.
    await expect(page.getByTestId('announcer')).toHaveText('Deleted the note “Second”');

    await page.getByTestId('note-delete').click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('note-start')).toBeFocused();
    await expect(page.getByTestId('announcer')).toHaveText('Deleted the note “First”');
  });

  test('a mark: on the next mark in its list, then on the list’s name', async ({ page }) => {
    await open(page);
    await mark(page, 1, 'amber');
    await mark(page, 3, 'amber');
    await page.getByTestId('marks-open').click();

    await page.getByTestId('marks-remove-john-1-1').click();
    await expect(page.getByTestId('confirm-body').locator('p')).toHaveText([
      'The verse leaves the collection “Amber”.',
      'You can undo this until your next change.',
    ]);
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('marks-go-john-1-3')).toBeFocused();

    await page.getByTestId('marks-remove-john-1-3').click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('marks-label-amber')).toBeFocused();
    await expect(page.getByTestId('marks-count-amber')).toHaveText('0');
  });

  test('a board: on the picker, then on "Start one" once none are left', async ({ page }) => {
    await open(page);
    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-start').click();
    await page.getByTestId('board-new').click();
    await expect(page.getByTestId('board-select').locator('option')).toHaveCount(2);

    await page.getByTestId('board-delete').click();
    await expect(page.getByRole('alertdialog', { name: 'Delete the board “Untitled board”?' })).toBeVisible();
    await expect(page.getByTestId('confirm-body').locator('p')).toHaveText(['The board is empty.', 'You cannot undo this.']);
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('board-select')).toBeFocused();
    await expect(page.getByTestId('board-select').locator('option')).toHaveCount(1);
    await expect(page.getByTestId('announcer')).toHaveText('Deleted the board “Untitled board”');

    await page.getByTestId('board-delete').click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('board-start')).toBeFocused();
  });

  test('a board with cards says how many go, and that notes stay', async ({ page }) => {
    await open(page);
    for (const verse of [1, 3]) {
      await page.getByTestId(`verse-${verse}`).click();
      await page.getByTestId(`canvas-${verse}`).click();
    }
    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-delete').click();
    await expect(page.getByTestId('confirm-body').locator('p')).toHaveText([
      'The board and its 2 cards will be deleted.',
      'Your notes are not changed.',
      'You cannot undo this.',
    ]);
  });
});

test.describe('"Start one" works with a pointer, in a fresh browser', () => {
  test('on the board screen, and focus goes to the new board', async ({ page }) => {
    await open(page);
    await page.getByTestId('canvas-open').click();
    await expect(page.getByTestId('board-select').locator('option')).toHaveText(['No boards yet']);
    // A real pointer press, hit-tested: Playwright refuses to click an
    // element that a press would pass through.
    await page.getByTestId('board-start').click();
    await expect(page.locator('.canvas__frame')).toBeVisible();
    await expect(page.getByTestId('board-select')).toBeFocused();
    await expect(page.getByTestId('board-select').locator('option')).toHaveText(['Untitled board']);
  });

  test('the check fails if presses pass through the button again', async ({ page }) => {
    await open(page);
    await page.getByTestId('canvas-open').click();
    await page.addStyleTag({ content: '.canvas__none { pointer-events: none; }' });
    await expect(page.getByTestId('board-start').click({ trial: true, timeout: 1_000 })).rejects.toThrow();
  });

  test('in the notes, and focus goes to the new note’s title', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-start').click();
    await expect(page.getByTestId('note-title')).toBeFocused();
    await expect(page.getByTestId('note-select').locator('option')).toHaveCount(1);
  });
});

/** What the dialog says, in each interface language, for an untitled note. */
const IN = {
  'es-MX': {
    title: '¿Eliminar la nota “Sin título”?',
    cancel: 'Cancelar',
    action: 'Eliminar nota',
    done: 'Se eliminó la nota “Sin título”',
  },
  'fr-FR': {
    title: 'Supprimer la note « Sans titre » ?',
    cancel: 'Annuler',
    action: 'Supprimer la note',
    done: 'Note « Sans titre » supprimée',
  },
  'ja-JP': {
    title: 'ノート「無題」を削除しますか？',
    cancel: 'キャンセル',
    action: 'ノートを削除',
    done: 'ノート「無題」を削除しました',
  },
  'pt-BR': {
    title: 'Excluir a nota “Sem título”?',
    cancel: 'Cancelar',
    action: 'Excluir nota',
    done: 'A nota “Sem título” foi excluída',
  },
  'zh-Hans': {
    title: '删除笔记“无标题”吗？',
    cancel: '取消',
    action: '删除笔记',
    done: '已删除笔记“无标题”',
  },
  'zh-Hant': {
    title: '要刪除筆記「無標題」嗎？',
    cancel: '取消',
    action: '刪除筆記',
    done: '已刪除筆記「無標題」',
  },
} as const;

for (const [locale, words] of Object.entries(IN)) {
  test.describe(`in ${locale}`, () => {
    test.use({ locale });

    test('the dialog asks in the interface language, and its buttons are named by their words', async ({ page }) => {
      await open(page);
      await page.getByTestId('note-new').click();
      await page.getByTestId('note-delete').click();

      const box = page.getByRole('alertdialog', { name: words.title });
      await expect(box).toBeVisible();
      // No language of its own: it is interface text, in the page's language.
      expect(await dialog(page).evaluate((el) => el.closest('[lang]')?.getAttribute('lang'))).toBe(locale);
      expect(await dialog(page).evaluate((el) => el.closest('[lang]') === document.documentElement)).toBe(true);
      await expect(page.getByTestId('confirm-cancel')).toHaveText(words.cancel);
      await expect(page.getByTestId('confirm-cancel')).toHaveAccessibleName(words.cancel);
      await expect(page.getByTestId('confirm-accept')).toHaveText(words.action);
      await expect(page.getByTestId('confirm-accept')).toHaveAccessibleName(words.action);

      await page.getByTestId('confirm-accept').click();
      await expect(page.getByTestId('note-start')).toBeFocused();
      await expect(page.getByTestId('announcer')).toHaveText(words.done);
    });
  });
}
