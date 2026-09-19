import '@binaryoperations/json-tree-editor/themes/default.css';
import './styles.css';

import { render } from 'solid-js/web';
import { BreadcrumbDemo } from './components/BreadcrumbDemo';

const root = document.getElementById('root');
if (!root) throw new Error('root not found');
render(() => <BreadcrumbDemo />, root);
