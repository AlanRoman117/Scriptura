import {
  HIDE_AFTER,
  INITIAL,
  SHOW_AFTER,
  nextMenus,
  padFor,
  rebase,
  scrollsByKey,
  type RecedeState,
  type ScrollSample,
} from '../../apps/reader/src/lib/recede';

/**
 * When the menus step aside on a small screen, and when they come back.
 *
 * The hook only feeds scroll positions to `nextMenus`, so what a scroll means
 * is stated here, where it needs no browser.
 */

/** A scroller 500px tall over 5000px of text, at `top`. */
const at = (top: number, over: Partial<ScrollSample> = {}): ScrollSample => ({ top, height: 500, scrollHeight: 5000, ...over });

/** Feed a run of positions through, starting from a scroller already measured. */
function run(tops: number[], start: RecedeState = { ...INITIAL, height: 500 }, gain = 0): RecedeState {
  return tops.reduce((state, top) => nextMenus(state, at(top), gain), start);
}

describe('scrolling on hides the menus', () => {
  test('not before the reader has gone far enough to mean it', () => {
    expect(run([10, 20, HIDE_AFTER - 1]).menus).toBe('shown');
    expect(run([10, 20, HIDE_AFTER]).menus).toBe('hidden');
  });

  test('travel is measured from the highest point, so wavering does not add up', () => {
    // Down 30, back up 30, down 30 again: never 48 below where it started.
    expect(run([30, 0, 30]).menus).toBe('shown');
    // From 400, up to 380, then on: 48 below 380 is what counts.
    const from400 = { menus: 'shown' as const, anchor: 400, height: 500 };
    expect(run([380, 380 + HIDE_AFTER - 1], from400).menus).toBe('shown');
    expect(run([380, 380 + HIDE_AFTER], from400).menus).toBe('hidden');
  });
});

describe('scrolling back shows them', () => {
  const hidden: RecedeState = { menus: 'hidden', anchor: 1000, height: 500 };

  test('after a short way back, shorter than the way out', () => {
    expect(SHOW_AFTER).toBeLessThan(HIDE_AFTER);
    expect(run([1000 - SHOW_AFTER + 1], hidden).menus).toBe('hidden');
    expect(run([1000 - SHOW_AFTER], hidden).menus).toBe('shown');
  });

  test('measured from the lowest point reached', () => {
    expect(run([1200, 1200 - SHOW_AFTER + 1], hidden).menus).toBe('hidden');
    expect(run([1200, 1200 - SHOW_AFTER], hidden).menus).toBe('shown');
  });

  test('and always at the top', () => {
    expect(run([0], { menus: 'hidden', anchor: 10, height: 500 }).menus).toBe('shown');
  });

  test('then on again hides them again', () => {
    const shown = run([1000 - SHOW_AFTER], hidden);
    expect(shown.menus).toBe('shown');
    expect(run([1000 - SHOW_AFTER + HIDE_AFTER], shown).menus).toBe('hidden');
  });
});

describe('what is not the reader scrolling', () => {
  test('an elastic overscroll past the end, springing back, shows nothing', () => {
    // The end is 4500. iOS reports positions beyond it, then returns.
    const atEnd: RecedeState = { menus: 'hidden', anchor: 4500, height: 500 };
    expect(run([4560, 4530, 4500], atEnd).menus).toBe('hidden');
  });

  test('an overscroll above the top is the top', () => {
    expect(run([-40], { menus: 'hidden', anchor: 30, height: 500 }).menus).toBe('shown');
    expect(run([-40, -10, 0]).menus).toBe('shown');
  });

  test('the scroller changing size decides nothing, and travel starts again from there', () => {
    // A note's scroller grows when its menus leave; at the end of the note the
    // browser then pulls the position back, which is not a scroll back.
    const hidden: RecedeState = { menus: 'hidden', anchor: 4500, height: 500 };
    const grown = nextMenus(hidden, at(4350, { height: 650 }));
    expect(grown).toEqual({ menus: 'hidden', anchor: 4350, height: 650 });
    // The first sample of all is a change of size too: nothing is decided on it.
    expect(nextMenus(INITIAL, at(900)).menus).toBe('shown');
    expect(nextMenus(INITIAL, at(900)).anchor).toBe(900);
  });
});

describe('a note, which grows when its menus leave', () => {
  // The picker row and the tabs give back 150px.
  const GAIN = 150;

  test('keeps them until the reader has scrolled as far as they are tall', () => {
    // 100px on is enough travel, but the room given back would be blank.
    expect(run([20, 60, 100], { ...INITIAL, height: 500 }, GAIN).menus).toBe('shown');
    expect(run([20, 60, 100, GAIN], { ...INITIAL, height: 500 }, GAIN).menus).toBe('hidden');
  });

  test('a note too short to scroll that far keeps them', () => {
    const short = (top: number): ScrollSample => ({ top, height: 500, scrollHeight: 600 });
    let state: RecedeState = { ...INITIAL, height: 500 };
    for (const top of [20, 60, 100]) state = nextMenus(state, short(top), GAIN);
    expect(state.menus).toBe('shown');
  });

  test('the text stays where it is: padded by what the menus gave back', () => {
    expect(padFor(GAIN, 400)).toBe(GAIN);
    // From the button, near the top: only as much as was scrolled can be
    // held, and the text moves up into the room.
    expect(padFor(GAIN, 40)).toBe(40);
    expect(padFor(GAIN, 0)).toBe(0);
    expect(padFor(0, 400)).toBe(0);
  });
});

/*
 * A pane also scrolls when focus moves to a verse out of view, or a pressed
 * verse is brought clear of its actions. The browser placed that verse for
 * the menus being where they were; menus that answered the scroll would come
 * back over it. The hook rebases on those instead of deciding.
 */
describe('a scroll the reader did not make', () => {
  test('moves where travel is measured from, and nothing else', () => {
    const hidden: RecedeState = { menus: 'hidden', anchor: 2000, height: 500 };
    // 300px back up, to bring a focused verse into view: far more than SHOW_AFTER.
    expect(rebase(hidden, at(1700))).toEqual({ menus: 'hidden', anchor: 1700, height: 500 });
    // The reader then scrolling back from there is measured from there.
    expect(run([1700 - SHOW_AFTER], rebase(hidden, at(1700))).menus).toBe('shown');

    const shown: RecedeState = { menus: 'shown', anchor: 0, height: 500 };
    expect(rebase(shown, at(900)).menus).toBe('shown');
    expect(run([900 + HIDE_AFTER - 1], rebase(shown, at(900))).menus).toBe('shown');
  });

  test('is clamped like any other', () => {
    expect(rebase({ ...INITIAL, height: 500 }, at(-30)).anchor).toBe(0);
    expect(rebase({ ...INITIAL, height: 500 }, at(4600)).anchor).toBe(4500);
  });
});

describe('which keys are the reader scrolling', () => {
  test.each(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '])('%j scrolls a pane', (key) => {
    expect(scrollsByKey(key, false)).toBe(true);
  });

  test('Tab moves focus, and the scroll that follows is the browser showing it', () => {
    expect(scrollsByKey('Tab', false)).toBe(false);
    expect(scrollsByKey('Enter', false)).toBe(false);
  });

  test('in a field the same keys move the caret', () => {
    expect(scrollsByKey('ArrowDown', true)).toBe(false);
    expect(scrollsByKey(' ', true)).toBe(false);
  });
});

test('nothing changes means the same object, so a scroll costs no render', () => {
  const state: RecedeState = { menus: 'shown', anchor: 0, height: 500 };
  expect(nextMenus(state, at(10))).toBe(state);
});
