import type { Locator, Page } from '@playwright/test';

/**
 * A board action by test id, reached the way a reader reaches it.
 *
 * Beside the Bible the less-used actions — Add note, Add to note, Delete
 * board and the pan buttons — fold behind "More" (CanvasView); on a wide
 * board they sit in the bar. This opens More first when the action is folded.
 */
export async function boardAction(page: Page, testId: string): Promise<Locator> {
  const action = page.getByTestId(testId);
  const more = page.getByTestId('board-more');
  if (!(await action.isVisible()) && (await more.isVisible()) && (await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
  return action;
}
