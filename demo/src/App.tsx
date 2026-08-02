import { JsonTreeView } from '../../json-tree-editor/src';
import {
  parseJsonSource,
  type JsonValidity,
} from '../../json-tree-editor/src/utils';
import { type Component, createMemo, createSignal } from 'solid-js';

import { DemoHeader } from './components/DemoHeader';
import { JsonEditor } from './components/JsonEditor';
import { JsonFormatted } from './components/JsonFormatted';

/** Sample starter JSON for the demo. */
const STARTER_JSON = `{
  "id": "rec_01HZX9K2M",
  "name": "Sample record",
  "active": true,
  "score": 42.5,
  "tags": ["json", "codemirror", "tree"],
  "meta": {
    "createdAt": "2026-03-15T12:00:00.000Z",
    "author": {
      "id": 7,
      "email": "dev@example.com"
    }
  },
  "items": [
    { "sku": "A-100", "qty": 3 },
    { "sku": "B-200", "qty": 1, "note": null }
  ]
}
`;

export const App: Component = () => {
  const [source, setSource] = createSignal(STARTER_JSON);
  const validity = createMemo(() => parseJsonSource(source()));

  const prettyPrint = () => {
    const v = validity();
    if (!v.ok) return;
    setSource(v.pretty + '\n');
  };

  /** Tree edits push pretty JSON back into the shared source string. */
  const onTreeChange = (pretty: string) => {
    setSource(pretty);
  };

  return (
    <div class="app">
      <DemoHeader page="main">
        <ValidityBadge validity={validity()} />
        <button
          type="button"
          class="btn"
          onClick={prettyPrint}
          disabled={!validity().ok}
          title={
            validity().ok
              ? 'Replace source with pretty-printed JSON'
              : 'Fix JSON errors before formatting'
          }
        >
          Pretty-print
        </button>
        <span class="meta">@json-tree-editor/demo · port 5176</span>
      </DemoHeader>

      <div class="panes panes--three">
        <section class="pane" aria-label="JSON source editor">
          <div class="pane-header">
            <span>Source</span>
            <span>lang-json · lint · line numbers · history</span>
          </div>
          <div class="pane-body">
            <JsonEditor value={source()} onChange={setSource} />
          </div>
        </section>

        <section class="pane" aria-label="JSON tree editor">
          <div class="pane-header">
            <span>Tree</span>
            <span>edit · add · remove · types</span>
          </div>
          <div class="pane-body">
            <JsonTreeView validity={validity()} onChange={onTreeChange} />
          </div>
        </section>

        <section class="pane" aria-label="Formatted JSON view">
          <div class="pane-header">
            <span>Formatted</span>
            <span>read-only · live parse</span>
          </div>
          <div class="pane-body">
            <JsonFormatted validity={validity()} />
          </div>
        </section>
      </div>

      <footer class="status-bar" role="status" aria-live="polite">
        <ShowValidityDetail validity={validity()} length={source().length} />
      </footer>
    </div>
  );
};

type ValidityBadgeProps = {
  validity: JsonValidity;
};

const ValidityBadge: Component<ValidityBadgeProps> = (props) => (
  <span
    classList={{
      'validity-badge': true,
      'validity-badge--ok': props.validity.ok,
      'validity-badge--err': !props.validity.ok,
    }}
    title={props.validity.ok ? 'Valid JSON' : props.validity.error}
  >
    {props.validity.ok ? 'Valid JSON' : 'Invalid JSON'}
  </span>
);

type DetailProps = {
  validity: JsonValidity;
  length: number;
};

const ShowValidityDetail: Component<DetailProps> = (props) => (
  <>
    <span
      classList={{
        'status-bar__pill': true,
        'status-bar__pill--ok': props.validity.ok,
        'status-bar__pill--err': !props.validity.ok,
      }}
    >
      {props.validity.ok ? '● valid' : '● invalid'}
    </span>
    <span class="status-bar__msg">
      {props.validity.ok
        ? 'JSON.parse succeeded · tree editable · gutter lint clear'
        : props.validity.error}
    </span>
    <span class="status-bar__meta">{props.length} chars</span>
  </>
);
