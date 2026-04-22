import { describe, test, expect, beforeAll, afterAll, spyOn, mock, beforeEach, afterEach } from 'bun:test';
import debug from '@aganitha/atk-debug';
import { loadConfig } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = join(tmpdir(), `atk-config-formats-${Date.now()}`);

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
    local: dir(subdir, 'local'),
  };
}

beforeAll(() => mkdirSync(TMP, { recursive: true }));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const schema = {
  port: { format: 'port', default: 3000 },
  host: { format: String, default: 'localhost' },
  debug: { format: Boolean, default: false },
};

// ─── YAML (.yaml) ────────────────────────────────────────────────────────────

describe('.yaml format', () => {
  test('loads standard YAML', async () => {
    write('yaml/config/config.yaml', 'port: 4000\nhost: yaml.local\n');

    const config = await loadConfig({ schema, paths: isolated('yaml') });

    expect(config.get('port')).toBe(4000);
    expect(config.get('host')).toBe('yaml.local');
    expect(config.getSources()[0]).toMatch(/\.yaml$/);
  });

  test('loads multi-line and nested YAML', async () => {
    const yaml = `
database:
  host: nested.local
  port: 5432
  credentials:
    user: admin
`.trimStart();
    write('yaml-nested/config/config.yaml', yaml);

    const nestedSchema = {
      database: {
        host: { format: String, default: 'localhost' },
        port: { format: 'port', default: 5432 },
        credentials: {
          user: { format: String, default: 'root' },
        },
      },
    };

    const config = await loadConfig({ schema: nestedSchema, paths: isolated('yaml-nested') });
    expect(config.get('database.host')).toBe('nested.local');
    expect(config.get('database.credentials.user')).toBe('admin');
  });

  test('YAML boolean values are coerced correctly', async () => {
    write('yaml-bool/config/config.yaml', 'debug: true\n');

    const config = await loadConfig({ schema, paths: isolated('yaml-bool') });
    expect(config.get('debug')).toBe(true);
    expect(typeof config.get('debug')).toBe('boolean');
  });
});

// ─── YAML (.yml extension) ───────────────────────────────────────────────────

describe('.yml extension', () => {
  test('loads .yml files (same as .yaml)', async () => {
    write('yml/config/config.yml', 'port: 5000\n');

    const config = await loadConfig({ schema, paths: isolated('yml') });

    expect(config.get('port')).toBe(5000);
    expect(config.getSources()[0]).toMatch(/\.yml$/);
  });

  test('.yaml takes priority over .yml when both exist', async () => {
    write('yml-priority/config/config.yaml', 'port: 1111\n');
    write('yml-priority/config/config.yml', 'port: 2222\n');

    // json is tried first, then yaml, then yml — yaml wins over yml
    const config = await loadConfig({ schema, paths: isolated('yml-priority') });
    expect(config.get('port')).toBe(1111);
  });
});

// ─── JSON ─────────────────────────────────────────────────────────────────────

describe('.json format', () => {
  test('loads standard JSON', async () => {
    write('json/config/config.json', JSON.stringify({ port: 6000, host: 'json.local' }));

    const config = await loadConfig({ schema, paths: isolated('json') });

    expect(config.get('port')).toBe(6000);
    expect(config.get('host')).toBe('json.local');
    expect(config.getSources()[0]).toMatch(/\.json$/);
  });

  test('JSON takes priority over YAML when both exist', async () => {
    write('json-priority/config/config.json', JSON.stringify({ port: 1111 }));
    write('json-priority/config/config.yaml', 'port: 2222\n');

    // extension priority: json > yaml > yml > json5
    const config = await loadConfig({ schema, paths: isolated('json-priority') });
    expect(config.get('port')).toBe(1111);
  });

  test('rejects malformed JSON with file context in error', async () => {
    write('json-bad/config/config.json', '{ port: 3000 }'); // invalid JSON (unquoted key)

    await expect(
      loadConfig({ schema, paths: isolated('json-bad') })
    ).rejects.toThrow('config.json');
  });
});

// ─── JSON5 ───────────────────────────────────────────────────────────────────

describe('.json5 format', () => {
  test('loads JSON5 with comments and trailing commas', async () => {
    const json5 = `{
  // Server configuration
  port: 7000,
  host: "json5.local",  // trailing comma is valid in JSON5
}`;
    write('json5/config/config.json5', json5);

    const config = await loadConfig({ schema, paths: isolated('json5') });

    expect(config.get('port')).toBe(7000);
    expect(config.get('host')).toBe('json5.local');
    expect(config.getSources()[0]).toMatch(/\.json5$/);
  });

  test('JSON5 is lowest priority — json/yaml/yml all win over it', async () => {
    write('json5-priority/config/config.json5', 'port: 9999\n');
    write('json5-priority/config/config.yaml', 'port: 1234\n');

    const config = await loadConfig({ schema, paths: isolated('json5-priority') });
    expect(config.get('port')).toBe(1234); // yaml wins
  });
});

// ─── Multiple formats for same base name ─────────────────────────────────────

describe('multiple formats for same base name', () => {
  test('warns to stderr and uses first match (json) when both json and yaml exist', async () => {
    write('multi/config/config.json', JSON.stringify({ port: 1111 }));
    write('multi/config/config.yaml', 'port: 2222\n');

    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const config = await loadConfig({ 
      schema, 
      paths: isolated('multi'),
      debug: true 
    });

    const allOutput = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();

    // json wins (tried first in format list)
    expect(config.get('port')).toBe(1111);

    // Warning was emitted with new format
    expect(allOutput).toContain('atk:config');
    expect(allOutput).toContain('Warning');
    expect(allOutput).toContain('multiple config files');
  });
});

// ─── Extension fallback order ─────────────────────────────────────────────────

describe('extension fallback order: json > yaml > yml > json5', () => {
  test('json beats yaml beats yml beats json5', async () => {
    // Create all four — json should win
    write('ext-order/config/config.json', JSON.stringify({ port: 100 }));
    write('ext-order/config/config.yaml', 'port: 200\n');
    write('ext-order/config/config.yml', 'port: 300\n');
    write('ext-order/config/config.json5', '{ port: 400 }');

    const config = await loadConfig({ schema, paths: isolated('ext-order') });
    expect(config.get('port')).toBe(100);
  });

  test('falls through to yaml when json missing', async () => {
    write('ext-yaml-fallback/config/config.yaml', 'port: 200\n');
    write('ext-yaml-fallback/config/config.yml', 'port: 300\n');
    write('ext-yaml-fallback/config/config.json5', '{ port: 400 }');

    const config = await loadConfig({ schema, paths: isolated('ext-yaml-fallback') });
    expect(config.get('port')).toBe(200);
  });

  test('falls through to json5 when nothing else exists', async () => {
    write('ext-json5-fallback/config/config.json5', '{ port: 400 }');

    const config = await loadConfig({ schema, paths: isolated('ext-json5-fallback') });
    expect(config.get('port')).toBe(400);
  });
});

// ─── Debug mode output ────────────────────────────────────────────────────────

describe('debug mode', () => {
  afterEach(() => {
    debug.disable();
    delete process.env.DEBUG;
  });

  test('debug: true emits structured output to stderr', async () => {
    write('debug-out/config/config.yaml', 'port: 3000\n');

    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({
      schema,
      appName: 'testapp',
      strict: true,
      paths: isolated('debug-out'),
      debug: true,
    });

    const output = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();

    expect(output).toContain('atk:config');
    expect(output).toContain('NODE_ENV');
    expect(output).toContain('testapp');    // appName logged
    expect(output).toContain('strict');     // strict logged
    expect(output).toContain('Validation'); // validation result logged
  });

  test('debug: true logs override keys when overrides are applied', async () => {
    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({
      schema,
      overrides: { port: 9000 },
      paths: isolated('debug-overrides'),
      debug: true,
    });

    const output = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();

    expect(output).toContain('Overrides applied');
    expect(output).toContain('port');
  });

  test('debug: true with skipValidation logs that validation was skipped', async () => {
    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({
      schema,
      paths: isolated('debug-skip'),
      debug: true,
      skipValidation: true,
    });

    const output = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();

    expect(output).toContain('skipped');
  });

  test('DEBUG=atk:config env var enables debug mode', async () => {
    process.env.DEBUG = 'atk:config';
    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({ schema, paths: isolated('debug-env') });

    const output = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();
    delete process.env.DEBUG;

    expect(output).toContain('atk:config');
  });

  test('DEBUG=other:ns does not enable atk:config debug', async () => {
    process.env.DEBUG = 'express:*';
    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({ schema, paths: isolated('debug-other-ns') });

    const output = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();
    delete process.env.DEBUG;

    expect(output).not.toContain('atk:config');
  });

  test('DEBUG=express:*,atk:config (comma list) enables debug', async () => {
    process.env.DEBUG = 'express:router,atk:config,other';
    const spy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    await loadConfig({ schema, paths: isolated('debug-comma') });

    const output = spy.mock.calls.map(args => args[0]).join('\n');
    spy.mockRestore();
    delete process.env.DEBUG;

    expect(output).toContain('atk:config');
  });
});
