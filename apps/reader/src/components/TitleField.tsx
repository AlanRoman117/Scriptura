import type { TextareaHTMLAttributes } from 'react';

/**
 * A title field that shows its whole title: a note's title, a board's name.
 *
 * They were one-line inputs, so a long title scrolled sideways and was never
 * seen whole, its start cut off with no sign anything was hidden. A tooltip
 * would not answer it: it appears on hover, which a touch screen and a
 * keyboard never produce (1.4.13). So the field wraps, and grows to fit.
 *
 * ⚠️ It grows by CSS, not by measuring. The textarea and an invisible copy of
 * its text (the wrapper's `::after`, fed by `data-value`) share one grid
 * cell, so the row is always as tall as the text — under any stylesheet a
 * reader applies. A height measured in script was refitted when the text or
 * the width changed, and missed the text-spacing override (1.4.12), which
 * changes neither: it clipped 39px of a long title on a phone.
 *
 * The value stays one line: `oneLine` turns a pasted line break into a space,
 * and Enter is the caller's to handle.
 */
export function TitleField({
  className,
  value,
  placeholder,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className: string; value: string }) {
  return (
    <span className={`title-field ${className}-field`} data-value={value || placeholder || ''}>
      <textarea rows={1} className={className} value={value} placeholder={placeholder} {...rest} />
    </span>
  );
}

/** A title is one line of data: pasted line breaks, and the space around them, become one space. */
export const oneLine = (text: string): string => text.replace(/[ \t]*[\r\n]+[ \t]*/g, ' ');
