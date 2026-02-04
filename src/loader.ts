import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import JSON5 from 'json5';
import { substituteVariables } from './substitution.js';
import { deepMerge } from './merger.js';
import type { ConfigPaths } from './types.js';

function expandTilde(path: string): string {
  return path.startsWith('~') ? join(homedir(), path.slice(1)) : path;
}

function parseFileContent(content: string, filePath: string): any {
  try {
    const substituted = substituteVariables(content, filePath);

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return parseYaml(substituted);
    }

    if (filePath.endsWith('.json5')) {
      return JSON5.parse(substituted);
    }

    return JSON.parse(substituted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${filePath}: ${message}`);
  }
}

function findFile(basePath: string): { path: string; allFound: string[] } | null {
  const formats = ['json', 'yaml', 'yml', 'json5'];
  const found: string[] = [];

  for (const ext of formats) {
    const fullPath = `${basePath}.${ext}`;
    if (existsSync(fullPath)) {
      found.push(fullPath);
    }
  }

  if (found.length === 0) {
    return null;
  }

  return { path: found[0], allFound: found };
}

function loadFile(filePath: string, debug: boolean): any | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseFileContent(content, filePath);

    if (debug) {
      console.error(`[atk:config] Loaded ${filePath}`);
    }

    return parsed;
  } catch (error) {
    throw error;
  }
}

function tryLoadFile(basePath: string, debug: boolean, warnMultiple: boolean = false): any | null {
  const result = findFile(basePath);

  if (!result) {
    if (debug) {
      console.error(`[atk:config] Not found: ${basePath}.{json,yaml,yml,json5}`);
    }
    return null;
  }

  if (warnMultiple && result.allFound.length > 1) {
    console.error(`[atk:config] Warning: Multiple config files found for ${basePath}:`);
    result.allFound.forEach(f => console.error(`[atk:config]   - ${f}`));
    console.error(`[atk:config] Using: ${result.path}`);
  }

  return loadFile(result.path, debug);
}

export async function discoverAndLoad(
  files: string[],
  paths: ConfigPaths,
  appName: string | undefined,
  defaults: Record<string, any> | undefined,
  nodeEnv: string,
  debug: boolean
): Promise<any> {
  let config: any = {};

  if (defaults) {
    for (const file of files) {
      if (defaults[file]) {
        config = deepMerge(config, defaults[file]);
        if (debug) {
          console.error(`[atk:config] Loaded bundled default: ${file}`);
        }
      }
    }
  }

  const searchLocations = [
    { name: 'config', path: paths.config },
    { name: 'global', path: paths.global },
    { name: 'local', path: paths.local }
  ];

  for (const location of searchLocations) {
    const resolvedPath = expandTilde(location.path);

    for (const file of files) {
      const filePath = join(resolvedPath, file);
      const loaded = tryLoadFile(filePath, debug, true);

      if (loaded) {
        config = deepMerge(config, loaded);
      }
    }
  }

  const configPath = expandTilde(paths.config);
  const envPath = join(configPath, nodeEnv);
  const envLoaded = tryLoadFile(envPath, debug, true);

  if (envLoaded) {
    config = deepMerge(config, envLoaded);
  }

  if (appName) {
    const globalAppPath = join(expandTilde(paths.global), appName);
    const localAppPath = join(expandTilde(paths.local), appName);

    const globalApp = tryLoadFile(globalAppPath, debug, false);
    if (globalApp) {
      config = deepMerge(config, globalApp);
    }

    const localApp = tryLoadFile(localAppPath, debug, false);
    if (localApp) {
      config = deepMerge(config, localApp);
    }
  }

  return config;
}
