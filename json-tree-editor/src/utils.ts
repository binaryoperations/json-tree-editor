/**
 * Utilities and lower-level building blocks.
 *
 * Prefer the package root for {@link JsonTreeView}. Import this module for
 * parsing, path helpers, type utilities, and primitive components.
 */

// Primitives (except JsonTreeView — exported from the package root)
export {
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
  NullEditor,
  type NullEditorProps,
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
  expandedPathsUpToDepth,
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
  deepCloneJson,
  duplicateAtPath,
  duplicateKeyAtPath,
  uniqueObjectKey,
  parseCompleteNumber,
  parseNullEditorDraft,
  jsonTypeOf,
  convertJsonType,
  DEFAULT_OBJECT_KEY,
  defaultNewObject,
  defaultNewArray,
} from './lib/json-path';
