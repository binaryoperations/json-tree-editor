/**
 * Vanilla web component + historyPlugin demo — no Solid host app.
 * Requires WC source via Vite alias (or built dist for production consumers).
 */
import '@binaryoperations/json-tree-editor/web-component';
import {
  historyPlugin,
  type HistoryEntryMeta,
  type HistoryReadSnapshot,
} from '@binaryoperations/json-tree-editor/history';
import type { JsonTreeEditorElement } from '../../json-tree-editor/src/web-component';

import { mountDemoHeader } from './shell/header';

/** Shared history-stack / bootstrap styles (same classes as Solid HistoryApp). */
import './styles.css';

const SAMPLE = `{
  "id": "hist_01",
  "name": "History demo",
  "active": true,
  "score": 10,
  "notes": null,
  "tags": ["undo", "redo", "path-scoped"],
  "meta": {
    "author": "dev@example.com",
    "version": 1
  },
  "items": [
    { "sku": "A-100", "qty": 2 },
    { "sku": "B-200", "qty": 1 }
  ]
}
`;

const WC_BOOTSTRAP = `import '@binaryoperations/json-tree-editor/web-component';
import { historyPlugin } from '@binaryoperations/json-tree-editor/history';

const el = document.querySelector('json-tree-editor');
el.use(historyPlugin({ maxDepth: 50 }));
// or: el.plugins = [historyPlugin({ maxDepth: 50 })];

el.callCommand('undo');
el.callCommand('canUndo');
el.callCommand('readHistory');
`;

// Shared chrome (header + left Popover drawer)
const headerMount = document.querySelector<HTMLElement>('#demo-header');
const actionsTpl = document.querySelector<HTMLTemplateElement>(
  '#wc-history-header-actions',
);
if (!headerMount || !actionsTpl) {
  throw new Error('Missing #demo-header or #wc-history-header-actions');
}
const actions = actionsTpl.content.firstElementChild?.cloneNode(
  true,
) as HTMLElement;
mountDemoHeader({
  target: headerMount,
  page: 'wc-history',
  actions,
});

const treeEl = document.querySelector<JsonTreeEditorElement>('#tree');
if (!treeEl) throw new Error('Missing #tree json-tree-editor');
const tree: JsonTreeEditorElement = treeEl;

const status = document.querySelector<HTMLElement>('#status')!;
const pillCanUndo = document.querySelector<HTMLElement>('#pill-can-undo')!;
const pillCanRedo = document.querySelector<HTMLElement>('#pill-can-redo')!;
const pillUndoDepth = document.querySelector<HTMLElement>('#pill-undo-depth')!;
const pillRedoDepth = document.querySelector<HTMLElement>('#pill-redo-depth')!;
const btnUndo = document.querySelector<HTMLButtonElement>('#btn-undo')!;
const btnRedo = document.querySelector<HTMLButtonElement>('#btn-redo')!;
const btnClear = document.querySelector<HTMLButtonElement>('#btn-clear')!;
const btnSample = document.querySelector<HTMLButtonElement>('#btn-sample')!;
const depthUndo = document.querySelector<HTMLElement>('#depth-undo')!;
const depthRedo = document.querySelector<HTMLElement>('#depth-redo')!;
const depthBytes = document.querySelector<HTMLElement>('#depth-bytes')!;
const depthUndoCard = document.querySelector<HTMLElement>('#depth-undo-card')!;
const depthRedoCard = document.querySelector<HTMLElement>('#depth-redo-card')!;
const historyBackend = document.querySelector<HTMLElement>('#history-backend')!;
const undoStackHost = document.querySelector<HTMLElement>('#undo-stack-host')!;
const redoStackHost = document.querySelector<HTMLElement>('#redo-stack-host')!;
const bootstrapCode = document.querySelector<HTMLElement>('#bootstrap-code')!;
const btnCopyBootstrap =
  document.querySelector<HTMLButtonElement>('#btn-copy-bootstrap')!;

bootstrapCode.textContent = WC_BOOTSTRAP;

/** Register history before or after connect — queue works either way. */
tree.use(historyPlugin({ maxDepth: 50 }));
tree.value = SAMPLE;

function formatPathHint(path: readonly (string | number)[]): string {
  if (path.length === 0) return 'root';
  return path.map((p) => String(p)).join('.');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(msg: string) {
  status.textContent = msg;
}

function renderUndoStack(entries: HistoryEntryMeta[]) {
  if (entries.length === 0) {
    undoStackHost.innerHTML = `
      <p class="history-stack__empty">
        Stack empty — edit a key, value, or type in the tree to push an entry.
      </p>`;
    return;
  }

  // readHistory.entries is oldest→newest; reverse for newest-first UI.
  const newestFirst = [...entries].reverse();
  const list = document.createElement('ol');
  list.className = 'history-stack__list';
  list.setAttribute('aria-label', 'Undo stack');

  newestFirst.forEach((entry, index) => {
    const isTop = index === 0;
    const path = formatPathHint(entry.pathHint);
    const li = document.createElement('li');
    li.className = isTop
      ? 'history-stack__row history-stack__row--top'
      : 'history-stack__row';
    li.title = isTop ? 'Next Undo target' : `undo #${index + 1}`;
    li.innerHTML = `
      <span class="history-stack__rank" aria-hidden="true">${isTop ? '▶' : String(index + 1)}</span>
      <div class="history-stack__body">
        <div class="history-stack__primary">
          <span class="history-stack__path" title="${escapeAttr(path)}">${escapeHtml(path)}</span>
          ${isTop ? '<span class="history-stack__badge">next undo</span>' : ''}
        </div>
        <div class="history-stack__secondary">
          <span class="history-stack__commit">${escapeHtml(entry.commitKind)}</span>
          <span class="history-stack__sep">·</span>
          <span class="history-stack__kind">${escapeHtml(entry.kind)}</span>
          <span class="history-stack__sep">·</span>
          <span class="history-stack__size">${escapeHtml(formatBytes(entry.approxBytes))}</span>
        </div>
      </div>`;
    list.appendChild(li);
  });

  undoStackHost.replaceChildren(list);
}

function renderRedoStack(redoDepth: number) {
  if (redoDepth <= 0) {
    redoStackHost.innerHTML = `
      <p class="history-stack__empty">
        No redo entries. Undo first, then Redo to re-apply.
      </p>`;
    return;
  }
  const label = redoDepth === 1 ? 'entry' : 'entries';
  redoStackHost.innerHTML = `
    <p class="history-stack__redo-summary">
      <span class="history-stack__redo-count">${redoDepth}</span>
      ${label} waiting — use header <strong>Redo</strong>. Meta list is
      undo-only from <code>readHistory</code>.
    </p>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replaceAll("'", '&#39;');
}

function refreshHistoryUi() {
  const canUndo = tree.callCommand<boolean>('canUndo') === true;
  const canRedo = tree.callCommand<boolean>('canRedo') === true;
  const snap =
    (tree.callCommand('readHistory') as HistoryReadSnapshot | undefined) ??
    null;

  const undoDepth = snap?.undoDepth ?? 0;
  const redoDepth = snap?.redoDepth ?? 0;

  pillCanUndo.textContent = `canUndo: ${canUndo ? 'yes' : 'no'}`;
  pillCanUndo.classList.toggle('stat-pill--muted', !canUndo);
  pillCanRedo.textContent = `canRedo: ${canRedo ? 'yes' : 'no'}`;
  pillCanRedo.classList.toggle('stat-pill--muted', !canRedo);
  pillUndoDepth.textContent = `undo ${undoDepth}`;
  pillRedoDepth.textContent = `redo ${redoDepth}`;

  btnUndo.disabled = !canUndo;
  btnRedo.disabled = !canRedo;
  btnClear.disabled = undoDepth === 0 && redoDepth === 0;

  depthUndo.textContent = String(undoDepth);
  depthRedo.textContent = String(redoDepth);
  depthBytes.textContent =
    snap != null ? snap.approxBytes.toLocaleString() : '—';
  depthUndoCard.classList.toggle('history-depths__card--active', undoDepth > 0);
  depthRedoCard.classList.toggle('history-depths__card--active', redoDepth > 0);
  historyBackend.textContent = snap?.backend ?? '—';

  renderUndoStack(snap?.entries ?? []);
  renderRedoStack(redoDepth);

  setStatus(`History (WC) · undo ${undoDepth} · redo ${redoDepth}`);
}

function bumpHistorySoon() {
  // Runtime notifies plugins before host onChange; re-read after flush too.
  refreshHistoryUi();
  queueMicrotask(refreshHistoryUi);
}

tree.addEventListener('change', () => {
  bumpHistorySoon();
});

btnUndo.addEventListener('click', () => {
  if (tree.callCommand('undo') === true) bumpHistorySoon();
});

btnRedo.addEventListener('click', () => {
  if (tree.callCommand('redo') === true) bumpHistorySoon();
});

btnClear.addEventListener('click', () => {
  tree.callCommand('clearHistory');
  bumpHistorySoon();
});

btnSample.addEventListener('click', () => {
  tree.value = SAMPLE;
  // Host whole-document write clears history (default externalPolicy).
  queueMicrotask(() => {
    tree.callCommand('clearHistory');
    bumpHistorySoon();
  });
});

btnCopyBootstrap.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(WC_BOOTSTRAP);
    btnCopyBootstrap.textContent = 'Copied';
    window.setTimeout(() => {
      btnCopyBootstrap.textContent = 'Copy';
    }, 1600);
  } catch {
    /* ignore */
  }
});

// Initial UI once the element is upgraded / connected.
if (customElements.get('json-tree-editor')) {
  // Connected this frame or next — command bridge needs the Solid handle.
  requestAnimationFrame(() => {
    refreshHistoryUi();
    // Second frame: handle ref may flush after first paint.
    requestAnimationFrame(refreshHistoryUi);
  });
} else {
  void customElements.whenDefined('json-tree-editor').then(() => {
    requestAnimationFrame(refreshHistoryUi);
  });
}
