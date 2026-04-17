import { describe, test, expect } from 'bun:test';
import { deepMerge } from '../src/merger.js';

describe('deepMerge', () => {
  describe('object merging', () => {
    test('merges two flat objects', () => {
      expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    test('source overwrites target for scalar values', () => {
      expect(deepMerge({ x: 1 }, { x: 2 })).toEqual({ x: 2 });
    });

    test('deeply merges nested objects', () => {
      const a = { db: { host: 'localhost', port: 5432 } };
      const b = { db: { host: 'prod.db' } };
      expect(deepMerge(a, b)).toEqual({ db: { host: 'prod.db', port: 5432 } });
    });

    test('preserves target keys not present in source', () => {
      expect(deepMerge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
    });

    test('adds source keys not present in target', () => {
      expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    test('handles 3-level deep nesting', () => {
      const a = { a: { b: { c: 1, d: 2 } } };
      const b = { a: { b: { c: 9 } } };
      expect(deepMerge(a, b)).toEqual({ a: { b: { c: 9, d: 2 } } });
    });
  });

  describe('array behavior', () => {
    test('replaces arrays — does not merge them', () => {
      expect(deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] })).toEqual({ arr: [4, 5] });
    });

    test('source empty array replaces target array', () => {
      expect(deepMerge({ arr: [1, 2] }, { arr: [] })).toEqual({ arr: [] });
    });

    test('source array replaces target object', () => {
      expect(deepMerge({ val: { a: 1 } }, { val: [1, 2] })).toEqual({ val: [1, 2] });
    });
  });

  describe('type changes', () => {
    test('object → scalar: source wins', () => {
      expect(deepMerge({ db: { host: 'localhost' } }, { db: 'postgres://url' }))
        .toEqual({ db: 'postgres://url' });
    });

    test('scalar → object: source wins', () => {
      expect(deepMerge({ port: 5432 }, { port: { value: 5432, ssl: true } }))
        .toEqual({ port: { value: 5432, ssl: true } });
    });
  });

  describe('edge cases', () => {
    test('merging with empty source returns target copy', () => {
      expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
    });

    test('merging into empty target returns source copy', () => {
      expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
    });

    test('does not mutate target object', () => {
      const target = { a: 1, b: { c: 2 } };
      deepMerge(target, { b: { d: 3 } });
      expect(target).toEqual({ a: 1, b: { c: 2 } });
    });

    test('does not mutate source object', () => {
      const source = { b: { d: 3 } };
      deepMerge({ a: 1 }, source);
      expect(source).toEqual({ b: { d: 3 } });
    });

    test('handles null values in source', () => {
      expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null });
    });

    test('source overwrites a null target value with a scalar', () => {
      expect(deepMerge({ a: null }, { a: 42 })).toEqual({ a: 42 });
    });

    test('source object merges into a null target field — null treated as {}', () => {
      expect(deepMerge({ db: null }, { db: { host: 'new' } })).toEqual({ db: { host: 'new' } });
    });

    test('undefined value in source sets key to undefined in result', () => {
      const result = deepMerge({ a: 1 }, { a: undefined });
      expect(result).toHaveProperty('a');
      expect(result.a).toBeUndefined();
    });

    test('prototype pollution — __proto__ key does not affect Object.prototype', () => {
      const malicious = JSON.parse('{"__proto__":{"polluted":true}}');
      deepMerge({}, malicious);
      expect(({} as any).polluted).toBeUndefined();
    });

    test('prototype pollution — constructor.prototype key does not pollute', () => {
      const malicious = { constructor: { prototype: { hacked: true } } };
      deepMerge({}, malicious);
      expect(({} as any).hacked).toBeUndefined();
    });

    test('throws on circular reference in source', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(() => deepMerge({}, circular)).toThrow('Circular reference');
    });
  });
});
