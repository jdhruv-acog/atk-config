import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import JSON5 from 'json5';
import debug from '@aganitha/atk-debug';
import { substituteVariables } from './substitution.js';
import { deepMerge } from './merger.js';
import type { ConfigPaths } from './types.js';

const log = debug('atk:config');

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
    throw new Error(`Failed to parse ${filePath}:\n  ${message}`);
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

  if (found.length === 0) return null;

  return { path: found[0], allFound: found };
}

function loadFile(filePath: string): any {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseFileContent(content, filePath);

  log('  Loaded %s', filePath);

  return parsed;
}

function tryLoadFile(
  basePath: string,
  sources: string[],
  warnMultiple = false
): any | null {
  const result = findFile(basePath);

  if (!result) {
    log('  Skipped %s.{json,yaml,yml,json5} — not found', basePath);
    return null;
  }

  if (warnMultiple && result.allFound.length > 1) {
    log('Warning: multiple config files found for %s:', basePath);
    result.allFound.forEach(f => log('  %s', f));
    log('Using: %s', result.path);
  }

  sources.push(result.path);
  return loadFile(result.path);
}

export interface LoadResult {
  merged: any;
  sources: string[];
}

export async function discoverAndLoad(
  files: string[],
  paths: ConfigPaths,
  appName: string | undefined,
  baseConfig: Record<string, any> | undefined,
  nodeEnv: string
): Promise<LoadResult> {
  let merged: any = {};
  const sources: string[] = [];

  // Layer 1: baseConfig (base layer, lowest priority above schema defaults)
  if (baseConfig && Object.keys(baseConfig).length > 0) {
    merged = deepMerge(merged, baseConfig);
    log('  Applied baseConfig');
  }

  // Layer 2: project config dir (./config/)
  const configPath = expandTilde(paths.config);
  log('  Searching %s/', configPath);

  for (const file of files) {
    const loaded = tryLoadFile(join(configPath, file), sources, true);
    if (loaded) merged = deepMerge(merged, loaded);
  }

  // Layer 3: NODE_ENV overlay from project config dir only
  const envFilePath = join(configPath, nodeEnv);
  const envLoaded = tryLoadFile(envFilePath, sources, true);
  if (envLoaded) merged = deepMerge(merged, envLoaded);

  // Layer 4: global user config (~/.atk/)
  const globalPath = expandTilde(paths.global);
  log('  Searching %s/', globalPath);

  for (const file of files) {
    const loaded = tryLoadFile(join(globalPath, file), sources, false);
    if (loaded) merged = deepMerge(merged, loaded);
  }

  // Layer 5: appName-specific global config (~/.atk/{appName}.*)
  if (appName) {
    const globalApp = tryLoadFile(join(globalPath, appName), sources, false);
    if (globalApp) merged = deepMerge(merged, globalApp);
  }

  return { merged, sources };
}
