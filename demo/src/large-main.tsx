import 'json-tree-editor/styles.css';
import './styles.css';

import { render } from 'solid-js/web';

import { LargeApp } from './LargeApp';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

render(() => <LargeApp />, root);
