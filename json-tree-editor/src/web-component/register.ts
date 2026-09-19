import { JsonTreeEditor, TAG } from './index';

export function defineJsonTreeEditor(
  tag: string = TAG,
): typeof JsonTreeEditor {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, JsonTreeEditor);
  }
  return JsonTreeEditor;
}

// Auto-register on import (primary library surface for non-Solid hosts).
defineJsonTreeEditor();

export { JsonTreeEditor, TAG, TAG as JSON_TREE_EDITOR_TAG };
export type {
  JsonTreeEditorChangeDetail,
  JsonTreeEditorElement,
} from './index';
