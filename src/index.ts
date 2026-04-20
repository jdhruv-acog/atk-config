import convict from 'convict';
import convictFormatWithValidator from 'convict-format-with-validator';
import { discoverAndLoad } from './loader.js';
import type { LoadConfigOptions, ConfigInstance, ConfigPaths, InferConfig } from './types.js';

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
    debug = process.env.DEBUG?.split(',').map(s => s.trim()).includes('atk:config') ?? false,
  } = options;

  const configPaths: ConfigPaths = {
    config: paths.config || './config',
    global: paths.global || '~/.atk',
  };

  const nodeEnv = process.env.NODE_ENV || 'development';

  if (debug) {
    console.error('[atk:config] ─── Loading configuration ───────────────────');
    console.error(`[atk:config] NODE_ENV  : ${nodeEnv}`);
    console.error(`[atk:config] files     : ${files.join(', ')}`);
    if (appName) console.error(`[atk:config] appName   : ${appName}`);
    if (strict)  console.error(`[atk:config] strict    : true`);
  }

  const config = convict(schema as any);

  const { merged, sources } = await discoverAndLoad(
    files,
    configPaths,
    appName,
    baseConfig,
    nodeEnv,
    debug
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
      if (config.has(key)) {
        config.set(key as any, value);
        applied.push(key);
      }
    }
    if (debug && applied.length > 0) {
      console.error(`[atk:config]   Overrides applied: ${applied.join(', ')}`);
    }
  }

  if (debug) {
    console.error(`[atk:config] Sources  : ${sources.length > 0 ? sources.join(', ') : 'none'}`);
  }

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
    if (debug) console.error('[atk:config] Validating...');
    (config as any).validate();
    if (debug) console.error('[atk:config] ✓ Validation passed');
  } else {
    if (debug) console.error('[atk:config] Validation skipped (skipValidation: true)');
  }

  if (debug) {
    console.error('[atk:config] ─────────────────────────────────────────────');
  }

  return config as unknown as ConfigInstance<InferConfig<S>>;
}

export type { LoadConfigOptions, ConfigInstance, InferConfig } from './types.js';
export { deepMerge } from './merger.js';
