/**
 * A map that forgets what was used longest ago once it holds `limit` entries.
 *
 * A `Map` remembers insertion order, so moving an entry to the end on each read
 * is all it takes. Forgetting costs a recomputation and nothing else; never
 * forgetting would cost memory for as long as the tab stays open.
 */
export class BoundedCache<V> {
  private readonly entries = new Map<string, V>();

  constructor(private readonly limit: number) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.limit) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
