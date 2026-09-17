import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * No interface text is written straight into a component.
 *
 * Every word the reader sees or hears comes from a catalog in
 * `apps/reader/src/i18n/messages/`, so that each language has all of it. This
 * reads the components with the TypeScript parser and fails on English that
 * slipped back in: JSX text, a user-facing attribute (`aria-label`, `title`,
 * `placeholder`, …), a child expression, or an `announce()` call.
 *
 * What it deliberately lets through: comparisons (`mode === 'read'`),
 * arguments to ordinary calls (`bible.book('john')`), attributes nobody reads
 * (`className`, `data-testid`), and templates whose fixed parts are only
 * punctuation (`${book} ${chapter}:${verse}`).
 */

const ROOT = fileURLToPath(new URL('../../apps/reader/src/', import.meta.url));
const USER_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'label', 'confirmLabel', 'alt', 'aria-valuetext', 'aria-description']);
const LETTERS = /\p{L}{2,}/u;

/** The fixed text of a string or template literal, without its interpolations. */
function fixedText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
  return null;
}

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Where a literal with letters ends up, or null if it is not shown to anyone. */
function destination(node: ts.Node): string | null {
  let child: ts.Node = node;
  let p = node.parent;
  while (p) {
    if (ts.isBinaryExpression(p) && EQUALITY.has(p.operatorToken.kind)) return null;
    if (ts.isCaseClause(p)) return null;
    if (ts.isJsxAttribute(p)) return USER_ATTRS.has(p.name.getText()) ? `attribute ${p.name.getText()}` : null;
    if (ts.isJsxExpression(p)) {
      if (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent)) return 'child';
    }
    if (ts.isCallExpression(p)) {
      if (p.expression.getText() === 'announce' && p.arguments[0] === child) return 'announce()';
      return null;
    }
    if (ts.isFunctionLike(p) || ts.isSourceFile(p) || ts.isElementAccessExpression(p)) return null;
    child = p;
    p = p.parent;
  }
  return null;
}

export function hardCodedText(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const where = (node: ts.Node) => `${fileName}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && LETTERS.test(node.text)) {
      found.push(`${where(node)} JSX text ${JSON.stringify(node.text.trim())}`);
    } else {
      const text = fixedText(node);
      if (text !== null && LETTERS.test(text)) {
        const to = destination(node);
        if (to) found.push(`${where(node)} ${to} ${node.getText()}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const files = [
  'App.tsx',
  ...readdirSync(join(ROOT, 'components'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `components/${f}`),
];

describe('interface text lives in the catalogs', () => {
  test.each(files)('%s has no hard-coded words', (name) => {
    expect(hardCodedText(name, readFileSync(join(ROOT, name), 'utf8'))).toEqual([]);
  });

  test('the check has teeth: each way text slips in is caught', () => {
    const planted = `
      export function X({ n }: { n: number }) {
        announce('Saved');
        return (
          <div aria-label={\`Close \${n}\`} title="Help">
            Hello
            {n > 1 ? 'many' : 'one'}
          </div>
        );
      }`;
    expect(hardCodedText('planted.tsx', planted)).toHaveLength(6);
  });

  test('and lets through what nobody reads', () => {
    const fine = `
      export function X({ mode, n }: { mode: string; n: number }) {
        const b = bible.book('john');
        return (
          <div className="notes__bar" data-testid="note-new" aria-label={t.notes.body}>
            {mode === 'read' ? t.notes.write : t.notes.preview}
            {\`\${n} · \${n}:\${n}\`}
            ✕
          </div>
        );
      }`;
    expect(hardCodedText('fine.tsx', fine)).toEqual([]);
  });
});
