// Components (public root + primitives)
export {
  JsonTreeView,
  type JsonTreeViewProps,
  JsonTreeNode,
  type JsonTreeNodeProps,
  TypeBadge,
  type TypeBadgeProps,
  TypeSelect,
  type TypeSelectProps,
  KeyEditor,
  type KeyEditorProps,
  PrimitiveEditor,
  type PrimitiveEditorProps,
  StringEditor,
  type StringEditorProps,
  NumberEditor,
  type NumberEditorProps,
} from './components/primitives';

// Parse / validity
export {
  parseJsonSource,
  type JsonValidity,
} from './lib/parse-json';

// Path helpers and JSON shape utilities
export {
  type JsonPath,
  type JsonTypeName,
  pathKey,
  getAtPath,
  setAtPath,
  deleteAtPath,
  renameKeyAtPath,
  addPropertyAtPath,
  addItemAtPath,
  cloneJsonShape,
  addShapedItemAtPath,
  uniqueObjectKey,
  parseCompleteNumber,
  jsonTypeOf,
  convertJsonType,
} from './lib/json-path';
