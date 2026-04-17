import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { loadConfig } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── Test fixture helpers ───────────────────────────────────────────────────

const TMP = join(tmpdir(), `atk-config-tests-${Date.now()}`);

function dir(...parts: string[]) {
  return join(TMP, ...parts);
}

function write(path: string, content: string) {
  const fullPath = dir(path);
  mkdirSync(fullPath.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
}

// Paths config that isolates tests from actual system files
function isolated(subdir = 'default') {
  return {
    config: dir(subdir, 'config'),
    global: dir(subdir, 'global'),
    local:  dir(subdir, 'local'),
  };
}

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// Restore NODE_ENV after each test
let originalNodeEnv: string | undefined;
beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV;
});

// ─── Basic schema / defaults ────────────────────────────────────────────────

describe('basic loading', () => {
  test('loads with schema defaults only (no files)', async () => {
    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000, env: 'PORT_BASIC' },
      },
      paths: isolated('basic-defaults'),
    });

    expect(config.get('port')).toBe(3000);
  });

  test('auto-validates on load — bad value throws', async () => {
    delete process.env.PORT_BAD;

    await expect(
      loadConfig({
        schema: {
          port: { format: 'port', default: 99999, env: 'PORT_BAD' }, // 99999 is out of port range
        },
        paths: isolated('basic-bad'),
      })
    ).rejects.toThrow();
  });

  test('skipValidation: true defers validation', async () => {
    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 99999, env: 'PORT_SKIP' },
      },
      paths: isolated('basic-skip'),
      skipValidation: true,
    });

    // Value is accessible even though it would fail validation
    expect(config.get('port')).toBe(99999);

    // Explicit validate() now throws
    expect(() => config.validate()).toThrow();
  });
});

// ─── baseConfig ──────────────────────────────────────────────────────────────

describe('baseConfig (flat base layer)', () => {
  test('baseConfig is applied as the base layer', async () => {
    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        host: { format: String, default: 'localhost' },
      },
      baseConfig: { port: 8080 },
      paths: isolated('baseconfig-base'),
    });

    expect(config.get('port')).toBe(8080);
    expect(config.get('host')).toBe('localhost'); // schema default used
  });

  test('config files override baseConfig', async () => {
    write('baseconfig-override/config/config.yaml', 'port: 9000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      baseConfig: { port: 8080 },
      paths: isolated('baseconfig-override'),
    });

    expect(config.get('port')).toBe(9000);
  });

  test('baseConfig handles nested objects', async () => {
    const config = await loadConfig({
      schema: {
        database: {
          host: { format: String, default: 'localhost' },
          port: { format: 'port', default: 5432 },
        },
      },
      baseConfig: {
        database: { host: 'default.db' },
      },
      paths: isolated('baseconfig-nested'),
    });

    expect(config.get('database.host')).toBe('default.db');
    expect(config.get('database.port')).toBe(5432); // schema default
  });
});

// ─── File loading ────────────────────────────────────────────────────────────

describe('file loading', () => {
  test('loads a YAML config file', async () => {
    write('files-yaml/config/config.yaml', 'port: 4000\nhost: yaml.example.com\n');

    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        host: { format: String, default: 'localhost' },
      },
      paths: isolated('files-yaml'),
    });

    expect(config.get('port')).toBe(4000);
    expect(config.get('host')).toBe('yaml.example.com');
  });

  test('loads a JSON config file', async () => {
    write('files-json/config/config.json', JSON.stringify({ port: 5000 }));

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('files-json'),
    });

    expect(config.get('port')).toBe(5000);
  });

  test('silently skips missing files', async () => {
    // No files created — should load with defaults
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('files-missing'),
    });

    expect(config.get('port')).toBe(3000);
  });

  test('loads multiple files and deep merges them', async () => {
    write('files-multi/config/common.yaml', 'host: common.example.com\n');
    write('files-multi/config/app.yaml', 'port: 7000\n');

    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        host: { format: String, default: 'localhost' },
      },
      files: ['common', 'app'],
      paths: isolated('files-multi'),
    });

    expect(config.get('port')).toBe(7000);
    expect(config.get('host')).toBe('common.example.com');
  });

  test('later files override earlier files', async () => {
    write('files-order/config/common.yaml', 'port: 3000\n');
    write('files-order/config/app.yaml', 'port: 4000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      files: ['common', 'app'],
      paths: isolated('files-order'),
    });

    expect(config.get('port')).toBe(4000);
  });
});

// ─── NODE_ENV overlay ────────────────────────────────────────────────────────

describe('NODE_ENV environment overlay', () => {
  test('loads NODE_ENV-specific file from config dir', async () => {
    write('env-overlay/config/config.yaml', 'port: 3000\n');
    write('env-overlay/config/production.yaml', 'port: 80\n');

    process.env.NODE_ENV = 'production';
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('env-overlay'),
    });
    process.env.NODE_ENV = originalNodeEnv;

    expect(config.get('port')).toBe(80);
  });

  test('env-specific file overrides base file', async () => {
    write('env-base/config/config.yaml', 'port: 3000\nhost: default.com\n');
    write('env-base/config/staging.yaml', 'port: 8080\n');

    process.env.NODE_ENV = 'staging';
    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        host: { format: String, default: 'localhost' },
      },
      paths: isolated('env-base'),
    });
    process.env.NODE_ENV = originalNodeEnv;

    expect(config.get('port')).toBe(8080);
    expect(config.get('host')).toBe('default.com'); // not overridden by staging.yaml
  });

  test('defaults to development when NODE_ENV is unset', async () => {
    write('env-default/config/config.yaml', 'port: 3000\n');
    write('env-default/config/development.yaml', 'port: 4000\n');

    delete process.env.NODE_ENV;
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('env-default'),
    });
    process.env.NODE_ENV = originalNodeEnv;

    expect(config.get('port')).toBe(4000);
  });
});

// ─── Overrides ───────────────────────────────────────────────────────────────

describe('overrides', () => {
  test('overrides win over file values', async () => {
    write('overrides-file/config/config.yaml', 'port: 3000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      overrides: { port: 9999 },
      paths: isolated('overrides-file'),
    });

    expect(config.get('port')).toBe(9999);
  });

  test('overrides win over env vars', async () => {
    process.env.PORT_OVR = '8080';

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000, env: 'PORT_OVR' } },
      overrides: { port: 9999 },
      paths: isolated('overrides-env'),
    });

    delete process.env.PORT_OVR;
    expect(config.get('port')).toBe(9999);
  });

  test('undefined override values are ignored', async () => {
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      overrides: { port: undefined },
      paths: isolated('overrides-undef'),
    });

    expect(config.get('port')).toBe(3000);
  });

  test('unknown override keys are silently ignored', async () => {
    // Should not throw even in strict mode
    await expect(
      loadConfig({
        schema: { port: { format: 'port', default: 3000 } },
        overrides: { unknownKey: 'whatever', anotherUnknown: 123 },
        paths: isolated('overrides-unknown'),
        strict: true,
      })
    ).resolves.toBeDefined();
  });

  test('overrides work with dot-notation string keys', async () => {
    const config = await loadConfig({
      schema: {
        database: {
          host: { format: String, default: 'localhost' },
        },
      },
      overrides: { 'database.host': 'override.db' },
      paths: isolated('overrides-dotnotation'),
    });

    expect(config.get('database.host')).toBe('override.db');
  });

  test('overrides work with nested objects — flattened to dot-notation before applying', async () => {
    write('overrides-nested-obj/config/config.yaml',
      'database:\n  host: file.db\n  port: 5432\n');

    const config = await loadConfig({
      schema: {
        database: {
          host: { format: String, default: 'localhost' },
          port: { format: 'port', default: 5432 },
        },
      },
      overrides: { database: { host: 'override.db' } },  // nested object
      paths: isolated('overrides-nested-obj'),
    });

    // host is overridden, port is NOT blown away
    expect(config.get('database.host')).toBe('override.db');
    expect(config.get('database.port')).toBe(5432);
  });

  test('nested override only changes the specified keys, siblings survive', async () => {
    const config = await loadConfig({
      schema: {
        server: {
          host: { format: String, default: 'localhost' },
          port: { format: 'port', default: 3000 },
          debug: { format: Boolean, default: false },
        },
      },
      overrides: { server: { port: 9000 } },  // only port
      paths: isolated('overrides-siblings'),
    });

    expect(config.get('server.host')).toBe('localhost');  // untouched
    expect(config.get('server.port')).toBe(9000);         // overridden
    expect(config.get('server.debug')).toBe(false);       // untouched
  });
});

// ─── getSources ──────────────────────────────────────────────────────────────

describe('getSources()', () => {
  test('returns empty array when no files found', async () => {
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('sources-empty'),
    });

    expect(config.getSources()).toEqual([]);
  });

  test('returns loaded file paths in order', async () => {
    write('sources-order/config/common.yaml', 'port: 3000\n');
    write('sources-order/config/app.yaml', 'port: 4000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      files: ['common', 'app'],
      paths: isolated('sources-order'),
    });

    const sources = config.getSources();
    expect(sources.length).toBe(2);
    expect(sources[0]).toContain('common.yaml');
    expect(sources[1]).toContain('app.yaml');
  });

  test('only includes files that were actually found', async () => {
    write('sources-partial/config/app.yaml', 'port: 4000\n');
    // common.yaml does NOT exist

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      files: ['common', 'app'],
      paths: isolated('sources-partial'),
    });

    const sources = config.getSources();
    expect(sources.length).toBe(1);
    expect(sources[0]).toContain('app.yaml');
  });

  test('includes NODE_ENV file when loaded', async () => {
    write('sources-env/config/config.yaml', 'port: 3000\n');
    write('sources-env/config/production.yaml', 'port: 80\n');

    process.env.NODE_ENV = 'production';
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('sources-env'),
    });
    process.env.NODE_ENV = originalNodeEnv;

    const sources = config.getSources();
    expect(sources.some(s => s.includes('production.yaml'))).toBe(true);
  });

  test('getSources returns a copy — mutating it does not affect config', async () => {
    write('sources-copy/config/config.yaml', 'port: 3000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('sources-copy'),
    });

    const sources = config.getSources();
    sources.push('injected-fake-path');

    expect(config.getSources().length).toBe(1);
  });
});

// ─── appName global config ───────────────────────────────────────────────────

describe('appName', () => {
  test('loads appName file from global dir', async () => {
    write('appname/global/myapp.yaml', 'port: 7777\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'myapp',
      paths: isolated('appname'),
    });

    expect(config.get('port')).toBe(7777);
  });

  test('appName global overrides config dir files', async () => {
    write('appname-pri/config/config.yaml', 'port: 4000\n');
    write('appname-pri/global/mytool.yaml', 'port: 5555\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'mytool',
      paths: isolated('appname-pri'),
    });

    expect(config.get('port')).toBe(5555);
  });
});

// ─── Strict mode ─────────────────────────────────────────────────────────────

describe('strict mode', () => {
  test('strict: true throws on unknown keys in config files', async () => {
    write('strict-unknown/config/config.yaml', 'port: 3000\nunknownKey: value\n');

    await expect(
      loadConfig({
        schema: { port: { format: 'port', default: 3000 } },
        strict: true,
        paths: isolated('strict-unknown'),
      })
    ).rejects.toThrow();
  });

  test('strict: false (default) does not throw on unknown keys', async () => {
    write('strict-off/config/config.yaml', 'port: 3000\nunknownKey: value\n');

    await expect(
      loadConfig({
        schema: { port: { format: 'port', default: 3000 } },
        paths: isolated('strict-off'),
      })
    ).resolves.toBeDefined();
  });
});

// ─── Variable substitution in files ─────────────────────────────────────────

describe('variable substitution in config files', () => {
  test('${VAR:-default} substitutes in YAML', async () => {
    write('subst-yaml/config/config.yaml', 'host: ${DB_HOST:-localhost}\n');
    delete process.env.DB_HOST;

    const config = await loadConfig({
      schema: { host: { format: String, default: '' } },
      paths: isolated('subst-yaml'),
    });

    expect(config.get('host')).toBe('localhost');
  });

  test('env var value overrides yaml default substitution', async () => {
    write('subst-env/config/config.yaml', 'host: ${DB_HOST:-localhost}\n');
    process.env.DB_HOST = 'prod.db.example.com';

    const config = await loadConfig({
      schema: { host: { format: String, default: '' } },
      paths: isolated('subst-env'),
    });

    delete process.env.DB_HOST;
    expect(config.get('host')).toBe('prod.db.example.com');
  });

  test('${VAR:?message} throws when unset', async () => {
    write('subst-required/config/config.yaml', 'secret: ${REQUIRED_SECRET:?secret is required}\n');
    delete process.env.REQUIRED_SECRET;

    await expect(
      loadConfig({
        schema: { secret: { format: String, default: '' } },
        paths: isolated('subst-required'),
      })
    ).rejects.toThrow('secret is required');
  });
});

// ─── Priority order ──────────────────────────────────────────────────────────

describe('priority order — schema default < baseConfig < files < env vars < overrides', () => {
  test('full priority chain', async () => {
    write('priority/config/config.yaml', 'port: 4000\n');
    process.env.PORT_PRI = '5000';

    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 1000, env: 'PORT_PRI' },
      },
      baseConfig: { port: 2000 },   // wins over schema default (1000)
                                     // but config file (4000) wins over baseConfig
                                     // env var (5000) wins over file
                                     // overrides (6000) wins over env var
      overrides: { port: 6000 },
      paths: isolated('priority'),
    });

    delete process.env.PORT_PRI;
    expect(config.get('port')).toBe(6000);
  });

  test('env var wins over config file', async () => {
    write('priority-env/config/config.yaml', 'port: 4000\n');
    process.env.PORT_ENV_WIN = '5000';

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000, env: 'PORT_ENV_WIN' } },
      paths: isolated('priority-env'),
    });

    delete process.env.PORT_ENV_WIN;
    expect(config.get('port')).toBe(5000);
  });
});

// ─── Type inference ───────────────────────────────────────────────────────────
// These tests verify that config.get() returns correctly typed values.
// The explicit type annotations on each variable act as compile-time assertions —
// if the inferred type is wrong, TypeScript will error here before tests even run.

describe('type inference from schema', () => {
  test('get() returns the correct type for each format', async () => {
    const config = await loadConfig({
      schema: {
        port:     { format: 'port',    default: 3000 },
        workers:  { format: 'nat',     default: 4 },
        host:     { format: String,    default: 'localhost' },
        debug:    { format: Boolean,   default: false },
        logLevel: { format: ['debug', 'info', 'warn', 'error'] as const, default: 'info' as const },
        database: {
          host: { format: String, default: 'db.local' },
          port: { format: 'port', default: 5432 },
        },
      },
      paths: isolated('types-basic'),
    });

    // Compile-time type assertions (wrong type annotation would be a TypeScript error)
    const port: number     = config.get('port');
    const workers: number  = config.get('workers');
    const host: string     = config.get('host');
    const debug: boolean   = config.get('debug');
    const level: 'debug' | 'info' | 'warn' | 'error' = config.get('logLevel');
    const dbHost: string   = config.get('database.host');
    const dbPort: number   = config.get('database.port');
    const db: { host: string; port: number } = config.get('database');

    // Runtime value assertions
    expect(port).toBe(3000);
    expect(workers).toBe(4);
    expect(host).toBe('localhost');
    expect(debug).toBe(false);
    expect(level).toBe('info');
    expect(dbHost).toBe('db.local');
    expect(dbPort).toBe(5432);
    expect(db).toEqual({ host: 'db.local', port: 5432 });
  });

  test('getProperties() returns the full typed object', async () => {
    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        database: {
          host: { format: String, default: 'localhost' },
        },
      },
      paths: isolated('types-getprops'),
    });

    const props: { port: number; database: { host: string } } = config.getProperties();
    expect(props.port).toBe(3000);
    expect(props.database.host).toBe('localhost');
  });

  test('file values are returned with correct types', async () => {
    write('types-file/config/config.yaml', 'port: 8080\nhost: from-file.local\n');

    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        host: { format: String, default: 'localhost' },
      },
      paths: isolated('types-file'),
    });

    const port: number = config.get('port');
    const host: string = config.get('host');

    expect(port).toBe(8080);
    expect(host).toBe('from-file.local');
  });
});

// ─── config.has() ────────────────────────────────────────────────────────────

describe('config.has()', () => {
  test('returns true for a defined leaf key', async () => {
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('has-leaf'),
    });
    expect(config.has('port')).toBe(true);
  });

  test('returns true for a nested leaf via dot-notation', async () => {
    const config = await loadConfig({
      schema: {
        database: { host: { format: String, default: 'localhost' } },
      },
      paths: isolated('has-nested'),
    });
    expect(config.has('database.host')).toBe(true);
  });

  test('returns true for a namespace node (not just leaves)', async () => {
    const config = await loadConfig({
      schema: {
        database: { host: { format: String, default: 'localhost' } },
      },
      paths: isolated('has-namespace'),
    });
    expect(config.has('database')).toBe(true);
  });

  test('returns false for a nonexistent key', async () => {
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('has-missing'),
    });
    expect(config.has('nonexistent')).toBe(false);
  });

  test('returns false for a nonexistent nested key', async () => {
    const config = await loadConfig({
      schema: {
        database: { host: { format: String, default: 'localhost' } },
      },
      paths: isolated('has-missing-nested'),
    });
    expect(config.has('database.nonexistent')).toBe(false);
  });
});

// ─── paths.local layer ───────────────────────────────────────────────────────

describe('paths.local layer', () => {
  test('loads {files}.* from the local dir', async () => {
    write('local-layer/local/config.yaml', 'port: 8888\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('local-layer'),
    });

    expect(config.get('port')).toBe(8888);
  });

  test('local layer overrides config dir', async () => {
    write('local-override/config/config.yaml', 'port: 4000\n');
    write('local-override/local/config.yaml', 'port: 5000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('local-override'),
    });

    expect(config.get('port')).toBe(5000);
  });

  test('local file appears in getSources()', async () => {
    write('local-sources/local/config.yaml', 'port: 9000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('local-sources'),
    });

    expect(config.getSources().some(s => s.includes('local'))).toBe(true);
  });
});

// ─── appName local file ──────────────────────────────────────────────────────

describe('appName local file', () => {
  test('loads ./{appName}.* from local dir', async () => {
    write('appname-local/local/myapp.yaml', 'port: 6666\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'myapp',
      paths: isolated('appname-local'),
    });

    expect(config.get('port')).toBe(6666);
  });

  test('local appName file overrides global appName file', async () => {
    write('appname-local-wins/global/myapp.yaml', 'port: 5000\n');
    write('appname-local-wins/local/myapp.yaml', 'port: 6000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'myapp',
      paths: isolated('appname-local-wins'),
    });

    expect(config.get('port')).toBe(6000);
  });
});

// ─── Overrides edge cases ────────────────────────────────────────────────────

describe('overrides edge cases', () => {
  test('null override value is applied (unlike undefined which is skipped)', async () => {
    const config = await loadConfig({
      schema: { name: { format: String, default: 'original' } },
      overrides: { name: null },
      paths: isolated('overrides-null'),
      skipValidation: true,
    });
    expect(config.get('name')).toBeNull();
  });

  test('array override passes through intact — not flattened as a plain object', async () => {
    const config = await loadConfig({
      schema: { tags: { format: Array, default: [] } },
      overrides: { tags: ['a', 'b', 'c'] },
      paths: isolated('overrides-array'),
    });
    expect(config.get('tags')).toEqual(['a', 'b', 'c']);
  });

  test('3-level deep nested override is flattened and applied correctly', async () => {
    const config = await loadConfig({
      schema: {
        a: {
          b: {
            c: { format: String, default: 'original' },
            d: { format: String, default: 'untouched' },
          },
        },
      },
      overrides: { a: { b: { c: 'overridden' } } },
      paths: isolated('overrides-3deep'),
    });

    expect(config.get('a.b.c')).toBe('overridden');
    expect(config.get('a.b.d')).toBe('untouched');
  });
});

// ─── validate() per-call options ─────────────────────────────────────────────

describe('validate() per-call options', () => {
  test('validate() uses strict when loadConfig was called with strict: true', async () => {
    write('validate-strict/config/config.yaml', 'port: 3000\nunknownKey: oops\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      strict: true,
      skipValidation: true,
      paths: isolated('validate-strict'),
    });

    expect(() => config.validate()).toThrow();
  });

  test('validate({ allowed: "warn" }) overrides strict: true from loadConfig', async () => {
    write('validate-warn-override/config/config.yaml', 'port: 3000\nunknownKey: oops\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      strict: true,
      skipValidation: true,
      paths: isolated('validate-warn-override'),
    });

    expect(() => config.validate({ allowed: 'warn' })).not.toThrow();
  });
});

// ─── files array interactions with NODE_ENV ───────────────────────────────────

describe('files array interactions', () => {
  test('files: [] still fires NODE_ENV overlay', async () => {
    write('files-empty-env/config/development.yaml', 'port: 9090\n');

    delete process.env.NODE_ENV;
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      files: [],
      paths: isolated('files-empty-env'),
    });
    process.env.NODE_ENV = originalNodeEnv;

    expect(config.get('port')).toBe(9090);
  });

  test('custom files array still triggers NODE_ENV overlay', async () => {
    write('files-custom-env/config/base.yaml', 'port: 4000\n');
    write('files-custom-env/config/staging.yaml', 'port: 4443\n');

    process.env.NODE_ENV = 'staging';
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      files: ['base'],
      paths: isolated('files-custom-env'),
    });
    process.env.NODE_ENV = originalNodeEnv;

    expect(config.get('port')).toBe(4443);
  });
});

// ─── File loading edge cases ─────────────────────────────────────────────────

describe('file loading edge cases', () => {
  test('empty YAML file is silently skipped — falls back to defaults', async () => {
    write('edge-empty/config/config.yaml', '');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('edge-empty'),
    });

    expect(config.get('port')).toBe(3000);
  });

  test('comments-only YAML file is silently skipped', async () => {
    write('edge-comments/config/config.yaml', '# this file has only comments\n# nothing to load\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('edge-comments'),
    });

    expect(config.get('port')).toBe(3000);
  });

  test('nonexistent config dir does not crash', async () => {
    // isolated() creates dirs that do not exist — paths just point to empty dirs
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('edge-nodir'),
    });

    expect(config.get('port')).toBe(3000);
  });

  test('variable substitution works in JSON files', async () => {
    process.env.JSON_PORT = '7777';
    write('edge-json-subst/config/config.json', '{"port": "${JSON_PORT}"}');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      paths: isolated('edge-json-subst'),
    });

    delete process.env.JSON_PORT;
    expect(config.get('port')).toBe(7777);
  });
});
