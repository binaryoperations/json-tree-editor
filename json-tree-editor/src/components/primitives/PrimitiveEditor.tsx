import { type Component, createSignal, Show } from 'solid-js';

import { dateToJsonString, jsonTypeOf } from '../../lib/json-path';
import { HighlightText } from './HighlightText';
import { NullEditor } from './NullEditor';
import { NumberEditor } from './NumberEditor';
import { StringEditor } from './StringEditor';

export type PrimitiveEditorCommitOpts = {
  /** String focus-session id for history coalesce. */
  sessionId?: string;
};

export type PrimitiveEditorProps = {
  value: unknown;
  onCommit: (next: unknown, opts?: PrimitiveEditorCommitOpts) => void;
  /** Display value only — no inputs. */
  readOnly?: boolean;
  /** Debounced search query for `<mark>` highlights. */
  highlightQuery?: string;
  /** Stronger mark when this value is the active search match. */
  activeHighlight?: boolean;
};

/** Display/edit value for string rows — coerce live `Date` to ISO. */
function asStringValue(value: unknown): string {
  if (value instanceof Date) return dateToJsonString(value);
  return typeof value === 'string' ? value : String(value ?? '');
}

export const PrimitiveEditor: Component<PrimitiveEditorProps> = (props) => {
  const kind = () => jsonTypeOf(props.value);
  const query = () => props.highlightQuery ?? '';
  const active = () => !!props.activeHighlight;
  const [booleanEditing, setBooleanEditing] = createSignal(false);

  const showBooleanHighlight = () =>
    !props.readOnly &&
    kind() === 'boolean' &&
    !booleanEditing() &&
    query().trim().length > 0;

  return (
    <span class="json-tree-value" part="value">
      <Show when={props.readOnly}>
        <Show when={kind() === 'string'}>
          <span class="json-tree-input json-tree-input--string json-tree-input--readonly">
            <HighlightText
              text={asStringValue(props.value)}
              query={query()}
              active={active()}
            />
          </span>
        </Show>
        <Show when={kind() === 'number'}>
          <span class="json-tree-input json-tree-input--number json-tree-input--readonly">
            <HighlightText
              text={String(props.value)}
              query={query()}
              active={active()}
            />
          </span>
        </Show>
        <Show when={kind() === 'boolean'}>
          <span class="json-tree-input json-tree-input--boolean json-tree-input--readonly">
            <HighlightText
              text={String(props.value)}
              query={query()}
              active={active()}
            />
          </span>
        </Show>
        <Show when={kind() === 'null'}>
          <span class="json-tree-null" part="null">
            <HighlightText text="null" query={query()} active={active()} />
          </span>
        </Show>
      </Show>

      <Show when={!props.readOnly}>
        <Show when={kind() === 'string'}>
          <StringEditor
            value={asStringValue(props.value)}
            onCommit={(next, opts) => {
              // Always store plain string (never leave a Date instance in the tree).
              props.onCommit(
                next,
                opts?.sessionId != null
                  ? { sessionId: opts.sessionId }
                  : undefined,
              );
            }}
            highlightQuery={query()}
            activeHighlight={active()}
          />
        </Show>

        <Show when={kind() === 'number'}>
          <NumberEditor
            value={props.value as number}
            onCommit={props.onCommit}
            highlightQuery={query()}
            activeHighlight={active()}
          />
        </Show>

        <Show when={kind() === 'boolean'}>
          <Show
            when={showBooleanHighlight()}
            fallback={
              <select
                class="json-tree-input json-tree-input--boolean"
                part="input"
                value={String(props.value)}
                aria-label="Boolean value"
                ref={(el) => {
                  if (booleanEditing()) {
                    queueMicrotask(() => el.focus());
                  }
                }}
                onFocus={() => setBooleanEditing(true)}
                onBlur={() => setBooleanEditing(false)}
                onChange={(e) =>
                  props.onCommit(e.currentTarget.value === 'true')
                }
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            }
          >
            <span
              class="json-tree-input json-tree-input--boolean json-tree-input--readonly json-tree-input--search-display"
              role="button"
              tabindex={0}
              aria-label="Boolean value"
              onClick={() => setBooleanEditing(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setBooleanEditing(true);
                }
              }}
            >
              <HighlightText
                text={String(props.value)}
                query={query()}
                active={active()}
              />
            </span>
          </Show>
        </Show>

        <Show when={kind() === 'null'}>
          <NullEditor
            onCommit={props.onCommit}
            highlightQuery={query()}
            activeHighlight={active()}
          />
        </Show>
      </Show>
    </span>
  );
};
