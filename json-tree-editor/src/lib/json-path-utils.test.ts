import { describe, it, expect } from 'vitest';
import { pointerToJsonPath, jsonPathToPointer } from './json-path-utils';

describe('json-path-utils', () => {
  it('converts pointer to path and back', () => {
    const ptr = '/users/0/name';
    const path = pointerToJsonPath(ptr);
    expect(path).toEqual(['users', 0, 'name']);
    const back = jsonPathToPointer(path);
    expect(back).toBe('/users/0/name');
  });

  it('escapes ~ and / per RFC6901', () => {
    const path = ['a~b', 'c/d', 3];
    const ptr = jsonPathToPointer(path);
    expect(ptr).toBe('/a~0b/c~1d/3');
    const p2 = pointerToJsonPath(ptr);
    expect(p2).toEqual(path);
  });
});
