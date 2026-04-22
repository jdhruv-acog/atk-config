import convict from 'convict';
import convictFormatWithValidator from 'convict-format-with-validator';
import debug from '@aganitha/atk-debug';
import { discoverAndLoad } from './loader.js';
import type { LoadConfigOptions, ConfigInstance, ConfigPaths, InferConfig } from './types.js';

const log = debug('atk:config');

convict.addFormats(convictFormatWithValidator);

/**
 * Flatten a potentially-nested override object to dot-notation key paths.
 * { database: { host: 'new' } } → { 'database.host': 'new' }
 * This lets overrides work with nested objects, not just top-level keys.
 */
function flattenToKeys(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      Object.assign(result, flattenToKeys(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

/**
 * Load, merge, and validate configuration from files, environment variables,
 * and programmatic sources.
 *
 * Requires TypeScript 5.0+ for automatic type inference from the schema.
 * The return type is fully typed — no separate interface needed.
 *
 * @example
 * const config = await loadConfig({
 *   schema: {
 *     port: { format: 'port', default: 3000, env: 'PORT' },
 *     database: {
 *       host: { format: String, default: 'localhost', env: 'DB_HOST' },
 *     },
 *   },
 * });
 *
 * config.get('port')           // number
 * config.get('database.host')  // string
 */
export async function loadConfig<const S>(
  options: LoadConfigOptions<S>
): Promise<ConfigInstance<InferConfig<S>>> {
  const {
    schema,
    files = ['config'],
    baseConfig,
    overrides,
    paths = {},
    appName,
    strict = false,
    skipValidation = false,
  } = options;

  if (options.debug) {
    debug.enable('atk:config');
  } else if (process.env.DEBUG) {
    debug.enable(process.env.DEBUG);
  }

  const configPaths: ConfigPaths = {
    config: paths.config || './config',
    global: paths.global || '~/.atk',
  };

  const nodeEnv = process.env.NODE_ENV || 'development';

  log('─── Loading configuration ───────────────────');
  log('NODE_ENV  : %s', nodeEnv);
  log('files     : %s', files.join(', '));
  if (appName) log('appName   : %s', appName);
  if (strict)  log('strict    : true');

  const config = convict(schema as any);

  const { merged, sources } = await discoverAndLoad(
    files,
    configPaths,
    appName,
    baseConfig,
    nodeEnv
  );

  config.load(merged);

  // Apply overrides last — highest priority, wins over files and env vars.
  // Flatten nested objects to dot-notation paths first so { database: { host: 'x' } }
  // correctly sets only 'database.host' without wiping sibling keys.
  if (overrides) {
    const flat = flattenToKeys(overrides);
    const applied: string[] = [];
    for (const [key, value] of Object.entries(flat)) {
      if (value === undefined) continue;
      if ((config as any).has(key)) {
        config.set(key as any, value);
        applied.push(key);
      }
    }
    if (applied.length > 0) {
      log('  Overrides applied: %s', applied.join(', '));
    }
  }

  log('Sources  : %s', sources.length > 0 ? sources.join(', ') : 'none');

  // Attach getSources() — returns a copy so callers can't mutate internal state
  (config as any).getSources = function (): string[] {
    return [...sources];
  };

  // Patch validate() to respect the strict option from loadConfig
  const originalValidate = config.validate.bind(config);
  (config as any).validate = function (opts?: { allowed?: 'strict' | 'warn' }) {
    const validateOpts = opts ? { ...opts } : {};
    if (strict && !validateOpts.allowed) {
      validateOpts.allowed = 'strict';
    }
    originalValidate(validateOpts);
    return config;
  };

  if (!skipValidation) {
    log('Validating...');
    (config as any).validate();
    log('✓ Validation passed');
  } else {
    log('Validation skipped (skipValidation: true)');
  }

  log('─────────────────────────────────────────────');

  return config as unknown as ConfigInstance<InferConfig<S>>;
}

export type { LoadConfigOptions, ConfigInstance, InferConfig } from './types.js';
export { deepMerge } from './merger.js';
