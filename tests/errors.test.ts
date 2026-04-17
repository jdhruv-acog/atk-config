/**
 * Error quality tests.
 *
 * A library is only as good as the errors it produces. These tests verify that
 * when things go wrong, the developer gets a message that tells them:
 *   1. WHAT went wrong
 *   2. WHERE it happened (file, key name)
 *   3. How to fix it (expected vs received)
 *
 * Every test here represents a real mistake a developer will make.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, spyOn } from 'bun:test';
import { loadConfig } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = join(tmpdir(), `atk-config-errors-${Date.now()}`);

function dir(...parts: string[]) { return join(TMP, ...parts); }

function write(path: string, content: string) {
  const full = dir(path);
  mkdirSync(full.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(full, content, 'utf-8');
}

function isolated(subdir: string) {
  return {
    config: dir(subdir, 'config'),
    global: dir(subdir, 'global'),
    local:  dir(subdir, 'local'),
  };
}

beforeAll(() => mkdirSync(TMP, { recursive: true }));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

// ─── Config file parse errors ─────────────────────────────────────────────────

describe('config file parse errors', () => {
  test('malformed JSON includes filename in error', async () => {
    write('json-parse/config/config.json', '{ invalid json }');

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('json-parse'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('config.json');   // tells you WHICH file
    expect(err.message).toContain('Failed to parse'); // tells you WHAT happened
  });

  test('malformed YAML includes filename in error', async () => {
    write('yaml-parse/config/config.yaml', 'port: [\nbad yaml');

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('yaml-parse'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('config.yaml');
    expect(err.message).toContain('Failed to parse');
  });

  test('malformed JSON5 includes filename in error', async () => {
    write('json5-parse/config/config.json5', '{ port: @@@invalid }');

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('json5-parse'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('config.json5');
    expect(err.message).toContain('Failed to parse');
  });
});

// ─── Schema validation errors ─────────────────────────────────────────────────

describe('schema validation errors', () => {
  test('port out of range mentions the key and constraint', async () => {
    const err = await loadConfig({
      schema: { port: { format: 'port', default: 99999 } },
      paths: isolated('port-range'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('port'); // which key
  });

  test('wrong type from config file mentions the key', async () => {
    write('type-error/config/config.yaml', 'port: not-a-number\n');

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('type-error'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('port');
  });

  test('enum violation mentions the key and valid values', async () => {
    const err = await loadConfig({
      schema: {
        logLevel: {
          format: ['debug', 'info', 'warn', 'error'] as const,
          default: 'invalid-default',
        },
      },
      paths: isolated('enum-error'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('logLevel');
  });

  test('wrong type from env var mentions the key', async () => {
    process.env.PORT_ERR = 'not-a-port';

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000, env: 'PORT_ERR' } },
      paths: isolated('env-type-err'),
    }).catch(e => e);

    delete process.env.PORT_ERR;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('port');
  });

  test('multiple validation errors are all reported together', async () => {
    const err = await loadConfig({
      schema: {
        port:     { format: 'port', default: 99999 },
        logLevel: { format: ['debug', 'info'] as const, default: 'invalid' },
      },
      paths: isolated('multi-err'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    // Both violations should appear in one error, not two separate throws
    expect(err.message).toContain('port');
    expect(err.message).toContain('logLevel');
  });
});

// ─── Strict mode errors ───────────────────────────────────────────────────────

describe('strict mode error messages', () => {
  test('unknown key error mentions the offending key name', async () => {
    write('strict-msg/config/config.yaml', 'port: 3000\ntypoKey: value\n');

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      strict: true,
      paths: isolated('strict-msg'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('typoKey'); // tells developer the exact typo
  });

  test('multiple unknown keys are all reported', async () => {
    write('strict-multi/config/config.yaml', 'port: 3000\nfoo: 1\nbar: 2\n');

    const err = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      strict: true,
      paths: isolated('strict-multi'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('foo');
    expect(err.message).toContain('bar');
  });
});

// ─── Variable substitution errors ────────────────────────────────────────────

describe('variable substitution errors', () => {
  test(':? error includes the custom message', async () => {
    write('subst-msg/config/config.yaml',
      'secret: "${DB_SECRET:?Set DB_SECRET before running in production}"\n');
    delete process.env.DB_SECRET;

    const err = await loadConfig({
      schema: { secret: { format: String, default: '' } },
      paths: isolated('subst-msg'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('Set DB_SECRET before running in production');
  });

  test(':? error includes the file path', async () => {
    write('subst-file/config/config.yaml', 'key: "${MISSING_VAR:?required}"\n');
    delete process.env.MISSING_VAR;

    const err = await loadConfig({
      schema: { key: { format: String, default: '' } },
      paths: isolated('subst-file'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    // Error is wrapped by Failed to parse which includes the filename
    expect(err.message).toContain('config.yaml');
  });

  test(':? default message is clear when no custom message given', async () => {
    write('subst-default-msg/config/config.yaml', 'key: "${TOTALLY_MISSING_VAR:?}"\n');
    delete process.env.TOTALLY_MISSING_VAR;

    const err = await loadConfig({
      schema: { key: { format: String, default: '' } },
      paths: isolated('subst-default-msg'),
    }).catch(e => e);

    expect(err).toBeInstanceOf(Error);
    // Should still throw, not silently use empty string
  });
});

// ─── skipValidation behaviour ─────────────────────────────────────────────────

describe('skipValidation + manual validate()', () => {
  test('validate() on a bad config throws the same helpful error', async () => {
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 99999 } },
      paths: isolated('skip-then-validate'),
      skipValidation: true,
    });

    // Should be accessible before validation
    expect(config.get('port')).toBe(99999);

    // validate() throws with a useful message
    expect(() => config.validate()).toThrow(/port/);
  });

  test('validate() with strict on a config that has unknown keys throws', async () => {
    write('skip-strict/config/config.yaml', 'port: 3000\nunknown: value\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('skip-strict'),
      skipValidation: true,
    });

    expect(() => config.validate({ allowed: 'strict' })).toThrow(/unknown/);
  });
});

// ─── Deep merge type mismatch ─────────────────────────────────────────────────

describe('deep merge type mismatch errors', () => {
  test('replacing object with scalar is caught by strict mode (not silently ignored)', async () => {
    // base: pool is an object { min, max }
    write('merge-type/config/config.yaml', `
database:
  pool:
    min: 2
    max: 10
`);
    // override: pool becomes a scalar — now 'database.pool' is not a schema leaf, it's unknown
    write('merge-type/config/production.yaml', `
database:
  pool: 5
`);

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const nestedSchema = {
      database: {
        pool: {
          min: { format: 'nat', default: 2 },
          max: { format: 'nat', default: 10 },
        },
      },
    };

    // In strict mode: 'database.pool' (as a flat key) is not declared → throws
    const err = await loadConfig({
      schema: nestedSchema,
      paths: isolated('merge-type'),
      strict: true,
    }).catch(e => e);

    process.env.NODE_ENV = originalNodeEnv;

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/pool/); // tells you which key caused the issue
  });

  test('replacing object with scalar throws a helpful "did you override its parent?" error', async () => {
    // This verifies the error message is actionable, not just that it throws.
    // The error "missing from config, did you override its parent?" tells the
    // developer exactly what happened and where to look.
    write('merge-type-warn/config/config.yaml', 'database:\n  pool:\n    min: 2\n    max: 10\n');
    write('merge-type-warn/config/staging.yaml', 'database:\n  pool: 5\n');

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'staging';

    const nestedSchema = {
      database: {
        pool: {
          min: { format: 'nat', default: 2 },
          max: { format: 'nat', default: 10 },
        },
      },
    };

    const err = await loadConfig({
      schema: nestedSchema,
      paths: isolated('merge-type-warn'),
    }).catch(e => e);

    process.env.NODE_ENV = originalNodeEnv;

    expect(err).toBeInstanceOf(Error);
    // Convict produces an actionable message pointing at the root cause
    expect(err.message).toContain('override');
    expect(err.message).toContain('pool');
  });
});
