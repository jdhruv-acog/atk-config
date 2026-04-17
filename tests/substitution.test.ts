import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { substituteVariables } from '../src/substitution.js';

// Snapshot of env vars we touch — restored after each test
const originalEnv: Record<string, string | undefined> = {};
const testVars = ['TEST_VAR', 'MY_VAR', 'REQUIRED_VAR', 'FIRST', 'SECOND', 'lower_var'];

beforeEach(() => {
  testVars.forEach(k => { originalEnv[k] = process.env[k]; });
});

afterEach(() => {
  testVars.forEach(k => {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  });
});

describe('substituteVariables', () => {
  describe('bare ${VAR}', () => {
    test('returns env var value when set', () => {
      process.env.TEST_VAR = 'hello';
      expect(substituteVariables('${TEST_VAR}')).toBe('hello');
    });

    test('returns empty string when not set (bash convention)', () => {
      delete process.env.TEST_VAR;
      expect(substituteVariables('${TEST_VAR}')).toBe('');
    });

    test('returns empty string when set to empty string', () => {
      process.env.TEST_VAR = '';
      expect(substituteVariables('${TEST_VAR}')).toBe('');
    });

    test('substitutes within a larger string', () => {
      process.env.TEST_VAR = 'world';
      expect(substituteVariables('hello ${TEST_VAR}!')).toBe('hello world!');
    });
  });

  describe('${VAR:-default}', () => {
    test('uses value when set', () => {
      process.env.MY_VAR = 'actual';
      expect(substituteVariables('${MY_VAR:-fallback}')).toBe('actual');
    });

    test('uses default when not set', () => {
      delete process.env.MY_VAR;
      expect(substituteVariables('${MY_VAR:-fallback}')).toBe('fallback');
    });

    test('uses default when set to empty string', () => {
      process.env.MY_VAR = '';
      expect(substituteVariables('${MY_VAR:-fallback}')).toBe('fallback');
    });

    test('default can be empty', () => {
      delete process.env.MY_VAR;
      expect(substituteVariables('${MY_VAR:-}')).toBe('');
    });

    test('default can contain spaces', () => {
      delete process.env.MY_VAR;
      expect(substituteVariables('${MY_VAR:-hello world}')).toBe('hello world');
    });
  });

  describe('${VAR:?message}', () => {
    test('returns value when set', () => {
      process.env.REQUIRED_VAR = 'present';
      expect(substituteVariables('${REQUIRED_VAR:?must be set}')).toBe('present');
    });

    test('throws with message when not set', () => {
      delete process.env.REQUIRED_VAR;
      expect(() => substituteVariables('${REQUIRED_VAR:?this is required}')).toThrow('this is required');
    });

    test('throws when set to empty string', () => {
      process.env.REQUIRED_VAR = '';
      expect(() => substituteVariables('${REQUIRED_VAR:?cannot be empty}')).toThrow('cannot be empty');
    });

    test('includes file path in error when provided', () => {
      delete process.env.REQUIRED_VAR;
      expect(() =>
        substituteVariables('${REQUIRED_VAR:?required}', 'config/app.yaml')
      ).toThrow('config/app.yaml');
    });

    test('uses default message when none given', () => {
      delete process.env.REQUIRED_VAR;
      expect(() => substituteVariables('${REQUIRED_VAR:?}')).toThrow();
    });
  });

  describe('case sensitivity', () => {
    test('uppercase names work', () => {
      process.env.TEST_VAR = 'upper';
      expect(substituteVariables('${TEST_VAR}')).toBe('upper');
    });

    test('lowercase names work', () => {
      process.env.lower_var = 'lower';
      expect(substituteVariables('${lower_var}')).toBe('lower');
    });

    test('mixed case names work', () => {
      process.env.My_Var = 'mixed';
      expect(substituteVariables('${My_Var}')).toBe('mixed');
      delete process.env.My_Var;
    });
  });

  describe('multiple substitutions', () => {
    test('substitutes multiple variables in one string', () => {
      process.env.FIRST = 'foo';
      process.env.SECOND = 'bar';
      expect(substituteVariables('${FIRST}-${SECOND}')).toBe('foo-bar');
    });

    test('mixes set and unset variables', () => {
      process.env.FIRST = 'set';
      delete process.env.SECOND;
      expect(substituteVariables('${FIRST}/${SECOND:-default}')).toBe('set/default');
    });
  });

  describe('variable name formats', () => {
    test('variable names with digit suffixes work (${VAR_123})', () => {
      process.env.VAR_123 = 'digit-suffix';
      expect(substituteVariables('${VAR_123}')).toBe('digit-suffix');
      delete process.env.VAR_123;
    });

    test('variable names with leading digits work (${_0VAR})', () => {
      process.env._0VAR = 'leading-digit';
      expect(substituteVariables('${_0VAR}')).toBe('leading-digit');
      delete process.env._0VAR;
    });
  });

  describe('no substitution patterns', () => {
    test('leaves non-variable strings unchanged', () => {
      expect(substituteVariables('just a plain string')).toBe('just a plain string');
    });

    test('leaves malformed patterns unchanged — $VAR without braces', () => {
      expect(substituteVariables('$PLAIN')).toBe('$PLAIN');
    });

    test('leaves ${}  unchanged — empty braces have no var name', () => {
      expect(substituteVariables('${}')).toBe('${}');
    });

    test('leaves partial patterns unchanged — ${ without closing brace', () => {
      expect(substituteVariables('${UNCLOSED')).toBe('${UNCLOSED');
    });
  });
});
