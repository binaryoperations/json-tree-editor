/**
 * PRD §10.10 — WC: pre-connect `use` works; disconnect teardowns.
 * Also covers plugins property + command surface on the custom element.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsonTreeEditorPlugin } from './lib/editor-runtime/types';
import {
  JSON_TREE_EDITOR_TAG,
  type JsonTreeEditorElement,
} from './web-component';

const DOC = JSON.stringify({ name: 'Ada', count: 1 }, null, 2);

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function createEl(value = DOC): JsonTreeEditorElement {
  const el = document.createElement(
    JSON_TREE_EDITOR_TAG,
  ) as JsonTreeEditorElement;
  el.value = value;
  return el;
}

/** Wait until the Solid bridge has flushed (handle + queued use()). */
async function waitUntil(
  predicate: () => boolean,
  label = 'condition',
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('json-tree-editor web component — plugins (PRD §10.10)', () => {
  it('pre-connect use() queues, flushes on connect, serves callCommand', async () => {
    const el = createEl();
    const setups: string[] = [];

    const dispose = el.use({
      name: 'cmd',
      setup(ctx) {
        setups.push('setup');
        ctx.registerCommand('ping', (x: unknown) => `pong:${String(x)}`);
      },
    });

    // Bridge not ready before connect.
    expect(el.hasCommand('ping')).toBe(false);
    expect(el.callCommand('ping', 'hi')).toBeUndefined();
    expect(setups).toEqual([]);

    document.body.appendChild(el);

    await waitUntil(() => el.hasCommand('ping'), 'command registration');

    expect(setups).toEqual(['setup']);
    expect(el.hasCommand('ping')).toBe(true);
    expect(el.callCommand('ping', 'hi')).toBe('pong:hi');

    dispose();
    expect(el.hasCommand('ping')).toBe(false);
    expect(el.callCommand('ping')).toBeUndefined();
  });

  it('disconnect teardowns use()-registered plugins (dispose + commands gone)', async () => {
    const el = createEl();
    const disposed: string[] = [];

    el.use({
      name: 'history',
      setup(ctx) {
        ctx.registerCommand('undo', () => true, { exclusive: true });
        return () => disposed.push('history');
      },
    });

    document.body.appendChild(el);
    await waitUntil(() => el.hasCommand('undo'), 'undo command');

    expect(el.hasCommand('undo')).toBe(true);

    el.remove();

    expect(disposed).toEqual(['history']);
    // Bridge is null after disconnect — commands are gone.
    expect(el.hasCommand('undo')).toBe(false);
    expect(el.callCommand('undo')).toBeUndefined();
  });

  it('dispose of pre-connect use() before connect drops the queue entry', async () => {
    const el = createEl();
    const setups: string[] = [];

    const dispose = el.use({
      name: 'ghost',
      setup() {
        setups.push('should-not-run');
      },
    });
    dispose(); // cancel while still queued

    document.body.appendChild(el);
    // Allow a few ticks for mount + flush.
    await new Promise((r) => setTimeout(r, 20));

    expect(setups).toEqual([]);
    expect(el.hasCommand('anything')).toBe(false);
  });

  it('plugins property set before connect installs on mount', async () => {
    const el = createEl();
    const events: string[] = [];
    const logger: JsonTreeEditorPlugin = {
      name: 'logger',
      setup(ctx) {
        events.push('setup');
        ctx.registerCommand('log-ready', () => true);
      },
    };

    el.plugins = [logger];
    expect(el.hasCommand('log-ready')).toBe(false);

    document.body.appendChild(el);
    await waitUntil(() => el.hasCommand('log-ready'), 'plugins prop install');

    expect(events).toEqual(['setup']);
    expect(el.callCommand('log-ready')).toBe(true);

    el.remove();
    expect(el.hasCommand('log-ready')).toBe(false);
  });

  it('reconnect does not auto-revive disposed use() plugins', async () => {
    const el = createEl();
    let setups = 0;

    el.use({
      name: 'once',
      setup(ctx) {
        setups += 1;
        ctx.registerCommand('once', () => setups);
      },
    });

    document.body.appendChild(el);
    await waitUntil(() => el.hasCommand('once'), 'first mount');
    expect(el.callCommand('once')).toBe(1);

    el.remove();
    expect(el.hasCommand('once')).toBe(false);

    // Re-attach — host must re-register (FR-37).
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    expect(el.hasCommand('once')).toBe(false);
    expect(setups).toBe(1);
  });
});
