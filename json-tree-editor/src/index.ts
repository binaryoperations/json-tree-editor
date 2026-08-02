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
  ROOT_JSON_TYPES,
  ALL_JSON_TYPES,
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
  isJsonRootValue,
  EMPTY_ROOT,
  type JsonValidity,
  type JsonRootValue,
} from './lib/parse-json';

// Path helpers and JSON shape utilities
export {
  type JsonPath,
  type JsonTypeName,
  ROOT_PATH_KEY,
  pathKey,
  collectContainerPathKeys,
  collectVisiblePaths,
  pathDomId,
  defaultExpandedPaths,
  getAtPath,
  setAtPath,
  deleteAtPath,
  renameKeyAtPath,
  addPropertyAtPath,
  addItemAtPath,
  cloneJsonShape,
  siblingTemplateShape,
  addShapedItemAtPath,
  addShapedPropertyAtPath,
  uniqueObjectKey,
  parseCompleteNumber,
  jsonTypeOf,
  convertJsonType,
  DEFAULT_OBJECT_KEY,
  defaultNewObject,
  defaultNewArray,
} from './lib/json-path';
