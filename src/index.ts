import convict from 'convict';
import convictFormatWithValidator from 'convict-format-with-validator';
import { discoverAndLoad } from './loader.js';
import type { LoadConfigOptions, ConfigInstance, ConfigPaths } from './types.js';

convict.addFormats(convictFormatWithValidator);

const configOptionsMap = new WeakMap<ConfigInstance, LoadConfigOptions>();

async function performLoad<T>(options: LoadConfigOptions<T>): Promise<ConfigInstance<T>> {
  const {
    schema,
    files = ['config'],
    defaults,
    paths = {},
    appName,
    strict = false,
    debug = process.env.DEBUG === 'atk:config'
  } = options;

  const configPaths : ConfigPaths = {
    config: paths.config || './config',
    global: paths.global || '~/.atk',
    local: paths.local || '.',
  };

  const nodeEnv = process.env.NODE_ENV || 'development';

  if (debug) {
    console.error('[atk:config] Starting configuration load');
    console.error(`[atk:config] NODE_ENV: ${nodeEnv}`);
    console.error(`[atk:config] Files: ${files.join(', ')}`);
  }

  const config = convict(schema);

  const discovered = await discoverAndLoad(
    files,
    configPaths,
    appName,
    defaults,
    nodeEnv,
    debug
  );

  config.load(discovered);

  if (debug) {
    console.error('[atk:config] Configuration loaded and merged');
    console.error('[atk:config] Call config.validate() to validate');
  }

  const originalValidate = config.validate.bind(config);
  (config as any).validate = function(opts?: { allowed?: 'strict' | 'warn' }) {
    const validateOpts = opts || {};
    if (strict && !validateOpts.allowed) {
      validateOpts.allowed = 'strict';
    }
    originalValidate(validateOpts);
    return config;
  };

  (config as any).reload = async function() {
    const storedOptions = configOptionsMap.get(config);
    if (!storedOptions) {
      throw new Error('Cannot reload: config options not found');
    }

    const newConfig = await performLoad(storedOptions);

    const props = config.getProperties();
    for (const key in props) {
      delete (config as any)._instance[key];
    }

    const newProps = newConfig.getProperties();
    config.load(newProps);

    return config;
  };

  configOptionsMap.set(config, options);

  return config;
}

export async function loadConfig<T = any>(options: LoadConfigOptions<T>): Promise<ConfigInstance<T>> {
  return performLoad(options);
}

export type { LoadConfigOptions, ConfigInstance } from './types.js';
export { deepMerge } from './merger.js';
