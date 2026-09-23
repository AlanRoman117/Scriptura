import { History } from '../../apps/reader/src/lib/history';

describe('undo history', () => {
  const at = (text: string, start = text.length, end = start) => ({ text, start, end });

  /** Types `word` one character at a time, recording each keystroke. */
  function type(history: History, from: string, word: string): string {
    let text = from;
    for (const ch of word) {
      const next = text + ch;
      history.record(at(text), at(next), 'type');
      text = next;
    }
    return text;
  }

  test('a run of typing is one step per word', () => {
    const history = new History();
    const text = type(history, '', 'hello world');
    const first = history.undo(at(text));
    expect(first?.text).toBe('hello ');
    expect(history.undo(at('hello '))?.text).toBe('');
    expect(history.undo(at(''))).toBeNull();
  });

  test('moving the caret elsewhere starts a new step', () => {
    const history = new History();
    const text = type(history, '', 'ab');
    // The caret goes back to the start, and typing resumes there.
    history.record(at(text, 0), { text: 'x' + text, start: 1, end: 1 }, 'type');
    expect(history.undo(at('xab', 1))?.text).toBe('ab');
  });

  test('a formatting edit or an insertion is always its own step', () => {
    const history = new History();
    let text = type(history, '', 'word');
    history.record(at(text), at('**word**'), 'other');
    history.record(at('**word**'), at('**word** and more'), 'other');
    text = '**word** and more';
    expect(history.undo(at(text))?.text).toBe('**word**');
    expect(history.undo(at('**word**'))?.text).toBe('word');
  });

  test('redo returns what undo took, and a new edit forgets it', () => {
    const history = new History();
    const text = type(history, '', 'abc');
    const back = history.undo(at(text))!;
    expect(history.redo(at(back.text))?.text).toBe('abc');
    history.undo(at('abc'));
    history.record(at(''), at('z'), 'type');
    expect(history.canRedo).toBe(false);
  });

  test('deleting coalesces, and typing after deleting is a new step', () => {
    const history = new History();
    history.record(at('abc'), at('ab'), 'delete');
    history.record(at('ab'), at('a'), 'delete');
    history.record(at('a'), at('ax'), 'type');
    expect(history.undo(at('ax'))?.text).toBe('a');
    expect(history.undo(at('a'))?.text).toBe('abc');
  });

  test('keeps a bounded number of steps', () => {
    const history = new History();
    for (let i = 0; i < 250; i++) history.record(at(String(i)), at(String(i + 1)), 'other');
    let steps = 0;
    let current = at('250');
    for (let s = history.undo(current); s; s = history.undo(current)) {
      current = s;
      steps += 1;
    }
    expect(steps).toBe(200);
  });
});
