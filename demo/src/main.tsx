import 'json-tree-editor/styles.css';
import './styles.css';

import { render } from 'solid-js/web';

import { App } from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

render(() => <App />, root);
