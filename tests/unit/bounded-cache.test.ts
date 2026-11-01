import { BoundedCache } from '../../apps/reader/src/lib/bounded-cache';

describe('BoundedCache', () => {
  it('never holds more than its limit, however many keys pass through', () => {
    const cache = new BoundedCache<number>(100);
    for (let i = 0; i < 10_000; i += 1) cache.set(`title ${i}`, i);
    expect(cache.size).toBe(100);
    expect(cache.get('title 9999')).toBe(9999);
    expect(cache.get('title 0')).toBeUndefined();
  });

  it('forgets what was used longest ago, not what was added first', () => {
    const cache = new BoundedCache<number>(2);
    cache.set('kept', 1);
    cache.set('forgotten', 2);
    cache.get('kept');
    cache.set('new', 3);
    expect(cache.get('kept')).toBe(1);
    expect(cache.get('forgotten')).toBeUndefined();
    expect(cache.get('new')).toBe(3);
  });

  it('does not count a key twice when it is set again', () => {
    const cache = new BoundedCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(3);
    expect(cache.get('b')).toBe(2);
  });

  it('keeps a width of zero, which is a measurement and not a miss', () => {
    const cache = new BoundedCache<number>(2);
    cache.set('', 0);
    expect(cache.get('')).toBe(0);
  });

  it('holds nothing after being cleared', () => {
    const cache = new BoundedCache<number>(2);
    cache.set('a', 1);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
