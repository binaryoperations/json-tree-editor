import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { type Component, createEffect, onCleanup, onMount } from 'solid-js';

export type JsonEditorProps = {
  /** Initial document content (read once on mount; external updates sync via effect). */
  value: string;
  /** Called when the document changes. */
  onChange: (value: string) => void;
};

/**
 * CodeMirror 6 JSON source editor mounted on a Solid-managed div.
 * Lifecycle: create EditorView in onMount, destroy in onCleanup.
 * Includes syntax highlighting + jsonParseLinter for invalid JSON.
 */
export const JsonEditor: Component<JsonEditorProps> = (props) => {
  let host!: HTMLDivElement;
  let view: EditorView | undefined;
  /** Skip re-applying doc when the change originated from the editor itself. */
  let lastEmitted = props.value;

  onMount(() => {
    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const next = update.state.doc.toString();
      lastEmitted = next;
      props.onChange(next);
    });

    const state = EditorState.create({
      doc: props.value,
      extensions: [
        basicSetup,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        json(),
        linter(jsonParseLinter()),
        lintGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: '#0f1115',
            color: '#e6e8ec',
          },
          '.cm-content': {
            caretColor: '#e6e8ec',
          },
          '.cm-gutters': {
            backgroundColor: '#12151c',
            color: '#5c6575',
            border: 'none',
          },
          '.cm-activeLine': {
            backgroundColor: '#1a1f2a',
          },
          '.cm-activeLineGutter': {
            backgroundColor: '#1a1f2a',
          },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: '#2a3650 !important',
          },
          '.cm-cursor': {
            borderLeftColor: '#e6e8ec',
          },
          '.cm-lintRange-error': {
            backgroundImage: 'none',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
          },
        }),
        updateListener,
      ],
    });

    view = new EditorView({
      state,
      parent: host,
    });
  });

  // If parent pushes a different value (e.g. pretty-print), sync into the editor.
  createEffect(() => {
    const next = props.value;
    if (!view || next === lastEmitted) return;
    lastEmitted = next;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: next,
      },
    });
  });

  onCleanup(() => {
    view?.destroy();
    view = undefined;
  });

  return <div class="json-editor" ref={host} />;
};
