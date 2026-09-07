import '@binaryoperations/json-tree-editor/styles.css';
import './styles.css';

import { render } from 'solid-js/web';

import { HistoryApp } from './HistoryApp';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

render(() => <HistoryApp />, root);
