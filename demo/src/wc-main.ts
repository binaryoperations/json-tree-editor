/**
 * Vanilla web component demo — no Solid host app.
 * Requires library build: `pnpm --filter json-tree-editor build`
 * (or root `pnpm build` / `pnpm build:lib`).
 */
import 'json-tree-editor/web-component';

const SAMPLE = `{
  "id": "wc_demo",
  "name": "Web Component host",
  "active": true,
  "score": 9.5,
  "tags": ["custom-element", "shadow-dom", "vanilla"],
  "nested": {
    "ok": true,
    "count": 3
  }
}
`;

const source = document.querySelector<HTMLTextAreaElement>('#source')!;
const tree = document.querySelector<
  HTMLElement & {
    value: string;
    disabled: boolean;
  }
>('#tree')!;
const status = document.querySelector<HTMLElement>('#status')!;

let syncingFromTree = false;

function setStatus(msg: string) {
  status.textContent = msg;
}

// Property is preferred for value (especially large JSON).
source.value = SAMPLE;
tree.value = SAMPLE;

source.addEventListener('input', () => {
  if (syncingFromTree) return;
  tree.value = source.value;
  setStatus('host → tree (.value)');
});

tree.addEventListener('change', (e) => {
  const detail = (e as CustomEvent<{ value: string }>).detail;
  syncingFromTree = true;
  source.value = detail.value;
  syncingFromTree = false;
  setStatus(`tree → host (change, ${detail.value.length} chars)`);
});

tree.addEventListener('json-change', () => {
  // Same payload as `change`; both fire for framework flexibility.
});

document.querySelector('#btn-sample')!.addEventListener('click', () => {
  source.value = SAMPLE;
  tree.value = SAMPLE;
  setStatus('sample loaded');
});

document.querySelector('#btn-theme')!.addEventListener('click', () => {
  tree.classList.toggle('light');
  setStatus(tree.classList.contains('light') ? 'light theme' : 'dark theme');
});

document.querySelector('#btn-disabled')!.addEventListener('click', () => {
  tree.disabled = !tree.disabled;
  setStatus(tree.disabled ? 'disabled' : 'enabled');
});
