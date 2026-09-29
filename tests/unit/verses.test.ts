import { verseSeparator } from '../../apps/reader/src/lib/verses';

describe('verseSeparator', () => {
  test.each(['en', 'es', 'fr', 'pt-BR', 'ko'])('%s separates verses with a space', (language) => {
    expect(verseSeparator(language)).toBe(' ');
  });

  test.each(['ja', 'zh-Hans', 'zh-Hant', 'ZH-hant', 'zh'])('%s runs verses together', (language) => {
    expect(verseSeparator(language)).toBe('');
  });
});
