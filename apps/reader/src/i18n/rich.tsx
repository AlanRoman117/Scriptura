import { Fragment } from 'react';
import type { ReactNode } from 'react';

/**
 * A little inline markup for catalog text, turned into elements — never into
 * an HTML string, and nothing reaches `innerHTML`.
 *
 *   `code`     → <code>
 *   **strong** → <strong>
 *   *em*       → <em>
 *   {{Tab}}    → <kbd>
 *
 * Help and a few notices need emphasis, a key or a code sample in the middle
 * of a sentence, and where it falls in the sentence differs by language. So
 * the markup lives in the translated string, and each language puts it where
 * its own word order does. Code spans are taken literally, so `[[john 3:16]]`
 * and `**` inside them stay as typed.
 */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\{\{[^}]+\}\})/g;

export function rich(text: string): ReactNode {
  const parts = text.split(TOKEN);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part ? <Fragment key={i}>{part}</Fragment> : null;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('{{')) return <kbd key={i}>{part.slice(2, -2)}</kbd>;
    return <em key={i}>{part.slice(1, -1)}</em>;
  });
}

/**
 * A message with a slot for an element, like the results heading whose count
 * sits in its own span: "{count} matches for “love”" in English, but
 * "「love」の検索結果：{count} 件" in Japanese. The catalog decides where the
 * slot goes; the component supplies what fills it.
 */
export function withSlots(text: string, slots: Record<string, ReactNode>): ReactNode {
  const parts = text.split(/(\{[a-z]+\})/g);
  return parts.map((part, i) => {
    const name = /^\{([a-z]+)\}$/.exec(part)?.[1];
    if (name && name in slots) return <Fragment key={i}>{slots[name]}</Fragment>;
    return part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}
