import { expect, test } from '@playwright/test';

/**
 * WebMCP: our half of the contract.
 *
 * Playwright's Chromium has no WebMCP API (it is behind a flag, and an origin
 * trial beyond that), so the browser's half cannot be exercised here — and it
 * is not ours to test. What *is* ours is which tools we offer, what their
 * schemas say, what they answer, and above all what they refuse to change.
 * A fake `document.modelContext` is injected before the app boots.
 *
 * The load-bearing test in this file is "changes nothing until accepted". If
 * that goes red, an assistant can write to someone's notes unattended.
 */

/**
 * Stands in for the browser. Faithful on the point that matters: the real
 * `getTools()` returns `RegisteredTool` — name, description, schema and
 * annotations, but NO execute callback, since agents invoke through the
 * browser. A mock more generous than the platform hides exactly that mistake.
 */
async function installMockContext(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const registry = new Map<string, unknown>();
    const aborted: string[] = [];
    (window as unknown as { __webmcp: unknown }).__webmcp = { registry, aborted };

    (document as unknown as { modelContext: unknown }).modelContext = {
      async registerTool(tool: { name: string }, options?: { signal?: AbortSignal }) {
        registry.set(tool.name, tool);
        options?.signal?.addEventListener('abort', () => {
          aborted.push(tool.name);
          registry.delete(tool.name);
        });
      },
      async getTools() {
        return [...registry.values()].map((t) => {
          const tool = t as { name: string; description: string; inputSchema: unknown; annotations: unknown };
          return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
          };
        });
      },
    };
  });
}

const registered = (page: import('@playwright/test').Page) =>
  page.evaluate(() => [
    ...(window as unknown as { __webmcp: { registry: Map<string, unknown> } }).__webmcp.registry.keys(),
  ]);

/** Call a tool the way an agent would, through our own descriptor. */
const call = (page: import('@playwright/test').Page, name: string, args: Record<string, unknown> = {}) =>
  page.evaluate(
    async ([toolName, toolArgs]) => {
      const tool = window.scripturaAgent!.tools().find((t) => t.name === toolName);
      if (!tool) throw new Error(`no tool ${toolName}`);
      const result = (await tool.execute(toolArgs as Record<string, unknown>)) as {
        isError?: boolean;
        content: { text: string }[];
      };
      return { isError: !!result.isError, text: result.content.map((c) => c.text).join('\n') };
    },
    [name, args] as [string, Record<string, unknown>]
  );

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function enableAgent(page: import('@playwright/test').Page) {
  await page.getByTestId('settings-open').click();
  await page.getByTestId('agent-toggle').check();
}

test.describe('nothing is offered until it is asked for', () => {
  test('no tools are registered on a fresh visit', async ({ page }) => {
    await installMockContext(page);
    await open(page);
    // Registration alone leaks only names and descriptions — but an app whose
    // claim is that your notes stay yours should not open a second door and
    // mention it afterwards.
    expect(await registered(page)).toEqual([]);
  });

  test('turning it on registers, turning it off unregisters', async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await enableAgent(page);

    const names = await registered(page);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n.startsWith('scriptura_'))).toBe(true);

    await page.getByTestId('agent-toggle').uncheck();
    expect(await registered(page)).toEqual([]);
  });

  test('the choice survives a reload', async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await enableAgent(page);
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    expect((await registered(page)).length).toBeGreaterThan(0);
  });

  test('every tool declares whether it only reads', async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await enableAgent(page);

    const tools = await page.evaluate(() =>
      window.scripturaAgent!.tools().map((t) => ({
        name: t.name,
        readOnly: t.annotations.readOnlyHint,
        untrusted: t.annotations.untrustedContentHint,
      }))
    );
    // Everything that echoes stored data is marked untrusted, because a note is
    // the reader's own writing and may contain anything at all.
    expect(tools.every((t) => t.untrusted)).toBe(true);
    // Only the two proposal tools are not read-only, and neither can commit.
    const writers = tools.filter((t) => !t.readOnly).map((t) => t.name);
    expect(writers.sort()).toEqual(['scriptura_propose_marks', 'scriptura_propose_note']);
  });

  test('there is no tool that deletes anything', async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await enableAgent(page);
    const names = await page.evaluate(() => window.scripturaAgent!.toolNames());
    for (const forbidden of ['delete', 'remove', 'clear', 'reset']) {
      expect(names.filter((n) => n.includes(forbidden))).toEqual([]);
    }
  });
});

test.describe('reads are answered', () => {
  test.beforeEach(async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await enableAgent(page);
    await page.getByTestId('settings-close').click();
  });

  test('a passage comes back with its citation', async ({ page }) => {
    const { isError, text } = await call(page, 'scriptura_read_passage', { reference: 'John 3:16' });
    expect(isError).toBe(false);
    expect(text).toContain('For God so loved the world');
    expect(text).toContain('(BSB)');
  });

  test('an unresolvable reference is an error, not an invention', async ({ page }) => {
    const { isError, text } = await call(page, 'scriptura_read_passage', { reference: 'Hezekiah 4:2' });
    expect(isError).toBe(true);
    expect(text).toContain('Could not resolve');
  });

  test('search reports the true total, not the page it returns', async ({ page }) => {
    const { text } = await call(page, 'scriptura_search_scripture', { query: 'Jesus', limit: 5 });
    const total = Number(text.match(/^(\d+) match/)?.[1]);
    expect(total).toBeGreaterThan(100);
    // Five lines of results, one count line — the count is not the page size.
    expect(text.split('\n').filter((l) => l.includes(' — ')).length).toBe(5);
  });

  test('notes are readable by id, and listed first', async ({ page }) => {
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('On the prologue');
    await page.getByTestId('notes-surface').fill('The Word was with God.');

    const list = await call(page, 'scriptura_list_notes');
    expect(list.text).toContain('On the prologue');
    const id = list.text.split(' — ')[0].trim();

    const one = await call(page, 'scriptura_read_note', { id });
    expect(one.text).toContain('The Word was with God.');
  });
});

test.describe('writes are staged, never applied', () => {
  test.beforeEach(async ({ page }) => {
    await installMockContext(page);
    await open(page);
    await enableAgent(page);
    await page.getByTestId('settings-close').click();
  });

  test('a proposed note is a preview, and says so rather than claiming success', async ({ page }) => {
    const { isError, text } = await call(page, 'scriptura_propose_note', {
      title: 'Light and darkness',
      body: 'A study of John 1.',
    });
    expect(isError).toBe(false);
    // The tool must not report a save. An agent relaying "saved" to the reader
    // is the failure this whole design exists to prevent.
    expect(text).toContain('NOT saved');

    // The preview shows the contents, editable.
    await expect(page.getByTestId('proposal')).toBeVisible();
    await expect(page.getByTestId('proposal-body-input')).toHaveValue('A study of John 1.');
  });

  test('discarding writes nothing', async ({ page }) => {
    await call(page, 'scriptura_propose_note', { title: 'Unwanted', body: 'No thanks.' });
    await page.getByTestId('proposal-discard').click();
    await expect(page.getByTestId('proposal')).toHaveCount(0);

    const list = await call(page, 'scriptura_list_notes');
    expect(list.text).toBe('No notes yet.');
  });

  test('what is accepted is what the reader edited, not what was proposed', async ({ page }) => {
    await call(page, 'scriptura_propose_note', { title: 'Draft', body: 'Original wording.' });
    await page.getByTestId('proposal-title-input').fill('My title');
    await page.getByTestId('proposal-body-input').fill('My wording.');
    await page.getByTestId('proposal-accept').click();

    await expect(page.getByTestId('note-title')).toHaveValue('My title');
    await expect(page.getByTestId('notes-surface')).toHaveValue('My wording.');
  });

  test('proposed marks show each verse, and only the kept ones are applied', async ({ page }) => {
    const { text } = await call(page, 'scriptura_propose_marks', {
      color: 'amber',
      references: ['John 1:1', 'John 1:3', 'John 1:5'],
    });
    expect(text).toContain('nothing is marked yet');

    // Contents, not counts: a list of citations is not something anyone can
    // meaningfully approve.
    await expect(page.getByTestId('proposal-list')).toContainText('In the beginning was the Word');

    await page.getByTestId('proposal-keep-john-1-3').uncheck();
    await page.getByTestId('proposal-accept').click();

    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-highlight', 'amber');
    await expect(page.locator('.verse[data-verse="5"]')).toHaveAttribute('data-highlight', 'amber');
    await expect(page.locator('.verse[data-verse="3"]')).not.toHaveAttribute('data-highlight', /./);
  });

  test('a second proposal is refused while the first is still open', async ({ page }) => {
    await call(page, 'scriptura_propose_note', { title: 'First', body: 'one' });
    const second = await call(page, 'scriptura_propose_note', { title: 'Second', body: 'two' });

    // Swapping the contents under an open preview means the reader confirms
    // something other than what they read.
    expect(second.isError).toBe(true);
    expect(second.text).toContain('already waiting');
    await expect(page.getByTestId('proposal-body-input')).toHaveValue('one');
  });

  test('a reference that resolves to nothing is refused, not guessed', async ({ page }) => {
    const { isError, text } = await call(page, 'scriptura_propose_marks', {
      color: 'sky',
      references: ['Hezekiah 1:1'],
    });
    expect(isError).toBe(true);
    expect(text).toContain('None of those references resolved');
    await expect(page.getByTestId('proposal')).toHaveCount(0);
  });
});
