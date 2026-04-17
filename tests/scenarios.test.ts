/**
 * Real-world DX scenario tests.
 *
 * These tests mirror how actual applications use atk-config. Each scenario
 * describes a real situation a developer on the team will encounter.
 * If these pass, the library works for real use cases — not just unit cases.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { loadConfig } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = join(tmpdir(), `atk-config-scenarios-${Date.now()}`);

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

let savedNodeEnv: string | undefined;
beforeEach(() => { savedNodeEnv = process.env.NODE_ENV; });
afterEach(() => {
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
});

// ─── Scenario 1: Typical web API ─────────────────────────────────────────────

describe('scenario: web API with multiple environments', () => {
  const webSchema = {
    env: {
      doc: 'Runtime environment',
      format: ['production', 'development', 'test'],
      default: 'development',
      env: 'NODE_ENV',
    },
    port: {
      doc: 'HTTP port',
      format: 'port',
      default: 3000,
      env: 'PORT',
    },
    logLevel: {
      doc: 'Log verbosity',
      format: ['debug', 'info', 'warn', 'error'] as const,
      default: 'info',
      env: 'LOG_LEVEL',
    },
    database: {
      host: { format: String, default: 'localhost', env: 'DB_HOST' },
      port: { format: 'port', default: 5432, env: 'DB_PORT' },
    },
  };

  beforeAll(() => {
    write('web-api/config/common.yaml',
      'logLevel: info\ndatabase:\n  host: db.internal\n  port: 5432\n');
    write('web-api/config/app.yaml', 'port: 8080\n');
    write('web-api/config/development.yaml', 'logLevel: debug\ndatabase:\n  host: localhost\n');
    write('web-api/config/production.yaml',
      'logLevel: warn\ndatabase:\n  host: prod-primary.db\n  port: 5433\n');
    write('web-api/config/test.yaml', 'port: 9999\ndatabase:\n  host: test.db\n');
  });

  test('development environment uses dev overrides', async () => {
    process.env.NODE_ENV = 'development';

    const config = await loadConfig({
      schema: webSchema,
      files: ['common', 'app'],
      paths: isolated('web-api'),
    });

    expect(config.get('env')).toBe('development');
    expect(config.get('port')).toBe(8080);          // from app.yaml
    expect(config.get('logLevel')).toBe('debug');   // from development.yaml (overrides common.yaml)
    expect(config.get('database.host')).toBe('localhost'); // from development.yaml
    expect(config.get('database.port')).toBe(5432); // from common.yaml (development doesn't override)
  });

  test('production environment uses production overrides', async () => {
    process.env.NODE_ENV = 'production';

    const config = await loadConfig({
      schema: webSchema,
      files: ['common', 'app'],
      paths: isolated('web-api'),
    });

    expect(config.get('logLevel')).toBe('warn');
    expect(config.get('database.host')).toBe('prod-primary.db');
    expect(config.get('database.port')).toBe(5433); // overridden in production.yaml
  });

  test('test environment has isolated settings', async () => {
    process.env.NODE_ENV = 'test';

    const config = await loadConfig({
      schema: webSchema,
      files: ['common', 'app'],
      paths: isolated('web-api'),
    });

    expect(config.get('port')).toBe(9999);         // test.yaml overrides app.yaml
    expect(config.get('database.host')).toBe('test.db');
  });

  test('sources tell you exactly what was loaded', async () => {
    process.env.NODE_ENV = 'development';

    const config = await loadConfig({
      schema: webSchema,
      files: ['common', 'app'],
      paths: isolated('web-api'),
    });

    const sources = config.getSources();
    expect(sources.some(s => s.includes('common.yaml'))).toBe(true);
    expect(sources.some(s => s.includes('app.yaml'))).toBe(true);
    expect(sources.some(s => s.includes('development.yaml'))).toBe(true);
    // Non-existent files are never in sources
    expect(sources.some(s => s.includes('production.yaml'))).toBe(false);
  });
});

// ─── Scenario 2: CLI tool with Commander-style overrides ─────────────────────

describe('scenario: CLI tool with Commander-style overrides', () => {
  const cliSchema = {
    port:     { format: 'port', default: 3000, env: 'PORT' },
    host:     { format: String, default: 'localhost', env: 'HOST' },
    logLevel: { format: ['debug', 'info', 'warn', 'error'] as const, default: 'info', env: 'LOG_LEVEL' },
    verbose:  { format: Boolean, default: false, env: 'VERBOSE' },
  };

  beforeAll(() => {
    write('cli/config/config.yaml', 'port: 4000\nhost: 0.0.0.0\n');
  });

  test('Commander opts override config file values', async () => {
    // Simulates: program.parse() → commandOpts = { port: '9000', logLevel: 'debug' }
    const commandOpts = { port: '9000', logLevel: 'debug' };

    const config = await loadConfig({
      schema: cliSchema,
      paths: isolated('cli'),
      overrides: commandOpts,
    });

    expect(config.get('port')).toBe(9000);        // string '9000' coerced to number
    expect(config.get('logLevel')).toBe('debug');
    expect(config.get('host')).toBe('0.0.0.0');   // from config file, not in overrides
  });

  test('Commander opts override env vars', async () => {
    process.env.PORT_CLI = '8080';

    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000, env: 'PORT_CLI' },
      },
      paths: isolated('cli-env-override'),
      overrides: { port: '9999' },
    });

    delete process.env.PORT_CLI;
    expect(config.get('port')).toBe(9999); // CLI wins over env var
  });

  test('undefined opts (flag not passed) do not override config', async () => {
    // Commander sets opts to undefined when a flag is not passed
    const commandOpts = { port: undefined, logLevel: 'debug' };

    const config = await loadConfig({
      schema: cliSchema,
      paths: isolated('cli'),
      overrides: commandOpts,
    });

    expect(config.get('port')).toBe(4000);        // undefined override ignored → file value used
    expect(config.get('logLevel')).toBe('debug');  // defined override applied
  });

  test("Commander's internal options (version, help) are silently ignored", async () => {
    // Commander always adds these — they shouldn't cause errors
    const allCommanderOpts = {
      port: '5000',
      logLevel: 'warn',
      // Commander internals:
      version: '1.0.0',
      help: undefined,
      _name: 'my-cli',
    };

    // Should not throw even with strict: true (overrides bypass strict)
    await expect(
      loadConfig({
        schema: cliSchema,
        paths: isolated('cli'),
        overrides: allCommanderOpts,
        strict: true,
      })
    ).resolves.toBeDefined();
  });

  test('global opts + subcommand opts are merged correctly', async () => {
    // global opts (program.opts()):
    const globalOpts = { logLevel: 'debug' };

    // subcommand opts (command action handler first arg):
    const serveOpts = { port: '7000', host: '0.0.0.0' };

    const config = await loadConfig({
      schema: cliSchema,
      paths: isolated('cli'),
      overrides: { ...globalOpts, ...serveOpts },
    });

    expect(config.get('logLevel')).toBe('debug');   // from global opts
    expect(config.get('port')).toBe(7000);           // from serve opts
    expect(config.get('host')).toBe('0.0.0.0');      // from serve opts
  });
});

// ─── Scenario 3: Type coercion from env vars ──────────────────────────────────

describe('scenario: type coercion from environment variables', () => {
  afterEach(() => {
    delete process.env.COERCE_PORT;
    delete process.env.COERCE_DEBUG;
    delete process.env.COERCE_WORKERS;
  });

  test('string env var is coerced to number (port)', async () => {
    process.env.COERCE_PORT = '8080'; // env vars are always strings

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000, env: 'COERCE_PORT' } },
      paths: isolated('coerce-port'),
    });

    expect(config.get('port')).toBe(8080);          // number, not string
    expect(typeof config.get('port')).toBe('number');
  });

  test('"true" string env var is coerced to boolean true', async () => {
    process.env.COERCE_DEBUG = 'true';

    const config = await loadConfig({
      schema: { debug: { format: Boolean, default: false, env: 'COERCE_DEBUG' } },
      paths: isolated('coerce-bool-true'),
    });

    expect(config.get('debug')).toBe(true);
    expect(typeof config.get('debug')).toBe('boolean');
  });

  test('"false" string env var is coerced to boolean false', async () => {
    process.env.COERCE_DEBUG = 'false';

    const config = await loadConfig({
      schema: { debug: { format: Boolean, default: true, env: 'COERCE_DEBUG' } },
      paths: isolated('coerce-bool-false'),
    });

    expect(config.get('debug')).toBe(false);
    expect(typeof config.get('debug')).toBe('boolean');
  });

  test('"1" / "0" string env vars are coerced to boolean', async () => {
    process.env.COERCE_DEBUG = '1';

    const config = await loadConfig({
      schema: { debug: { format: Boolean, default: false, env: 'COERCE_DEBUG' } },
      paths: isolated('coerce-bool-1'),
    });

    expect(config.get('debug')).toBe(true);
  });

  test('string env var is coerced to nat (natural number)', async () => {
    process.env.COERCE_WORKERS = '4';

    const config = await loadConfig({
      schema: { workers: { format: 'nat', default: 1, env: 'COERCE_WORKERS' } },
      paths: isolated('coerce-nat'),
    });

    expect(config.get('workers')).toBe(4);
    expect(typeof config.get('workers')).toBe('number');
  });
});

// ─── Scenario 4: Secrets management ──────────────────────────────────────────

describe('scenario: secrets management', () => {
  test('sensitive fields are masked in toString()', async () => {
    const config = await loadConfig({
      schema: {
        database: {
          host:     { format: String, default: 'localhost' },
          password: { format: String, default: 'super-secret', sensitive: true },
        },
        apiKey: { format: String, default: 'sk-abc123', sensitive: true },
        port:   { format: 'port', default: 3000 },
      },
      paths: isolated('secrets'),
    });

    const str = config.toString();
    const parsed = JSON.parse(str);

    // Sensitive values are masked
    expect(parsed.database.password).toBe('[Sensitive]');
    expect(parsed.apiKey).toBe('[Sensitive]');

    // Non-sensitive values are visible
    expect(parsed.database.host).toBe('localhost');
    expect(parsed.port).toBe(3000);

    // The actual values are still accessible via get()
    expect(config.get('database.password')).toBe('super-secret');
    expect(config.get('apiKey')).toBe('sk-abc123');
  });

  test('async secret injection pattern works (pre-load vault fetch)', async () => {
    // Simulates: const secret = await fetchFromVault('key')
    const fetchedSecret = await Promise.resolve('vault-fetched-password');

    const config = await loadConfig({
      schema: {
        database: {
          password: { format: String, default: fetchedSecret, sensitive: true },
        },
      },
      paths: isolated('secrets-vault'),
    });

    expect(config.get('database.password')).toBe('vault-fetched-password');
  });

  test('env var can override injected secret default', async () => {
    process.env.SECRET_DB_PASS = 'from-env';

    const config = await loadConfig({
      schema: {
        database: {
          password: { format: String, default: 'vault-secret', env: 'SECRET_DB_PASS', sensitive: true },
        },
      },
      paths: isolated('secrets-env-override'),
    });

    delete process.env.SECRET_DB_PASS;
    // Env var wins over injected default
    expect(config.get('database.password')).toBe('from-env');
  });
});

// ─── Scenario 5: Global developer config (appName) ───────────────────────────

describe('scenario: global developer config via appName', () => {
  test('developer personal overrides from ~/.atk/{appName}.yaml are applied', async () => {
    write('devconfig/config/app.yaml', 'port: 3000\nlogLevel: info\n');
    // Simulate a developer's personal ~/.atk/myapp.yaml
    write('devconfig/global/myapp.yaml', 'logLevel: debug\n');

    const config = await loadConfig({
      schema: {
        port:     { format: 'port', default: 3000 },
        logLevel: { format: ['debug', 'info', 'warn', 'error'] as const, default: 'info' },
      },
      appName: 'myapp',
      paths: isolated('devconfig'),
    });

    expect(config.get('port')).toBe(3000);        // from project config
    expect(config.get('logLevel')).toBe('debug'); // from developer's personal config
  });

  test("developer's personal config does not affect other developers (it's just a file)", async () => {
    // Two developers: alice has a global config, bob doesn't
    write('alice/config/app.yaml', 'port: 3000\n');
    write('alice/global/myapp.yaml', 'port: 9999\n');

    write('bob/config/app.yaml', 'port: 3000\n');
    // bob has no global config

    const aliceConfig = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'myapp',
      paths: isolated('alice'),
    });

    const bobConfig = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'myapp',
      paths: isolated('bob'),
    });

    expect(aliceConfig.get('port')).toBe(9999); // alice's personal override
    expect(bobConfig.get('port')).toBe(3000);   // bob gets project default
  });

  test('appName file is shown in getSources()', async () => {
    write('appname-src/config/app.yaml', 'port: 3000\n');
    write('appname-src/global/myapp.yaml', 'port: 5000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      appName: 'myapp',
      paths: isolated('appname-src'),
    });

    const sources = config.getSources();
    expect(sources.some(s => s.includes('myapp.yaml'))).toBe(true);
    expect(sources.some(s => s.includes('app.yaml'))).toBe(true);
  });
});

// ─── Scenario 6: getProperties() for passing config around ───────────────────

describe('scenario: accessing config as typed object', () => {
  test('getProperties() returns a plain object with all values', async () => {
    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 3000 },
        database: {
          host: { format: String, default: 'localhost' },
          port: { format: 'port', default: 5432 },
        },
      },
      paths: isolated('getprops'),
    });

    const props = config.getProperties();

    expect(props).toEqual({
      port: 3000,
      database: { host: 'localhost', port: 5432 },
    });
    expect(typeof props).toBe('object');
  });

  test('getProperties() result is usable for spreading/passing around', async () => {
    const config = await loadConfig({
      schema: {
        host: { format: String, default: 'localhost' },
        port: { format: 'port', default: 5432 },
      },
      paths: isolated('getprops-spread'),
    });

    // Typical pattern: extract DB connection props
    const { host, port } = config.getProperties();
    expect(host).toBe('localhost');
    expect(port).toBe(5432);
  });
});

// ─── Scenario 7: Full priority chain all layers active ───────────────────────

describe('scenario: full priority chain with all layers active simultaneously', () => {
  test('schema default < baseConfig < file < env var < override', async () => {
    write('full-chain/config/config.yaml', 'port: 4000\n'); // layer 3 (file)
    process.env.PORT_CHAIN = '5000';                         // layer 4 (env var)

    const config = await loadConfig({
      schema: {
        port: { format: 'port', default: 1000, env: 'PORT_CHAIN' }, // layer 1
      },
      baseConfig: { port: 2000 },   // layer 2
      overrides: { port: 6000 },   // layer 5 (highest)
      paths: isolated('full-chain'),
    });

    delete process.env.PORT_CHAIN;

    // override (6000) wins over everything
    expect(config.get('port')).toBe(6000);
  });

  test('without override: env var beats file', async () => {
    write('chain-no-override/config/config.yaml', 'port: 4000\n');
    process.env.PORT_CHAIN2 = '5000';

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 1000, env: 'PORT_CHAIN2' } },
      baseConfig: { port: 2000 },
      paths: isolated('chain-no-override'),
    });

    delete process.env.PORT_CHAIN2;
    expect(config.get('port')).toBe(5000); // env var (5000) beats file (4000)
  });

  test('without env var: file beats baseConfig', async () => {
    write('chain-no-env/config/config.yaml', 'port: 4000\n');

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 1000 } },
      baseConfig: { port: 2000 },
      paths: isolated('chain-no-env'),
    });

    expect(config.get('port')).toBe(4000); // file (4000) beats baseConfig (2000)
  });

  test('without file: baseConfig beats schema default', async () => {
    const config = await loadConfig({
      schema: { port: { format: 'port', default: 1000 } },
      baseConfig: { port: 2000 },
      paths: isolated('chain-no-file'),
    });

    expect(config.get('port')).toBe(2000); // baseConfig (2000) beats schema default (1000)
  });
});

// ─── Scenario 8: The "why is my config wrong?" debugging workflow ─────────────

describe('scenario: debugging — why is my config value wrong?', () => {
  test('getSources() shows you what was actually loaded so you can trace a value', async () => {
    write('debug-why/config/common.yaml', 'port: 3000\n');
    write('debug-why/config/app.yaml', 'port: 4000\n'); // app overrides common

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000 } },
      files: ['common', 'app'],
      paths: isolated('debug-why'),
    });

    // Developer sees port is 4000, wonders why
    // getSources() tells them: app.yaml was loaded after common.yaml
    const sources = config.getSources();
    expect(sources[0]).toContain('common.yaml');
    expect(sources[1]).toContain('app.yaml'); // app.yaml loaded last → it wins
    expect(config.get('port')).toBe(4000);
  });

  test('when no files are found, getSources() is empty — values are from defaults/env', async () => {
    process.env.PORT_WHY = '7777';

    const config = await loadConfig({
      schema: { port: { format: 'port', default: 3000, env: 'PORT_WHY' } },
      paths: isolated('debug-why-empty'),
    });

    delete process.env.PORT_WHY;

    expect(config.getSources()).toEqual([]);
    expect(config.get('port')).toBe(7777); // value came from env var
    // Developer now knows: no files were loaded, the value came from PORT_WHY env var
  });
});
