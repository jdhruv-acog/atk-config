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

function loadFile(filePath: string, debug: boolean): any {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseFileContent(content, filePath);

  if (debug) {
    console.error(`[atk:config]   Loaded ${filePath}`);
  }

  return parsed;
}

function tryLoadFile(
  basePath: string,
  debug: boolean,
  sources: string[],
  warnMultiple = false
): any | null {
  const result = findFile(basePath);

  if (!result) {
    if (debug) {
      console.error(`[atk:config]   Skipped ${basePath}.{json,yaml,yml,json5} — not found`);
    }
    return null;
  }

  if (warnMultiple && result.allFound.length > 1) {
    console.error(`[atk:config] Warning: multiple config files found for ${basePath}:`);
    result.allFound.forEach(f => console.error(`[atk:config]   ${f}`));
    console.error(`[atk:config] Using: ${result.path}`);
  }

  sources.push(result.path);
  return loadFile(result.path, debug);
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
  nodeEnv: string,
  debug: boolean
): Promise<LoadResult> {
  let merged: any = {};
  const sources: string[] = [];

  // Layer 1: baseConfig (base layer, lowest priority above schema defaults)
  if (baseConfig && Object.keys(baseConfig).length > 0) {
    merged = deepMerge(merged, baseConfig);
    if (debug) {
      console.error('[atk:config]   Applied baseConfig');
    }
  }

  // Layer 2: project config dir (./config/)
  const configPath = expandTilde(paths.config);
  if (debug) console.error(`[atk:config]   Searching ${configPath}/`);

  for (const file of files) {
    const loaded = tryLoadFile(join(configPath, file), debug, sources, true);
    if (loaded) merged = deepMerge(merged, loaded);
  }

  // Layer 3: NODE_ENV overlay from project config dir only
  const envFilePath = join(configPath, nodeEnv);
  const envLoaded = tryLoadFile(envFilePath, debug, sources, true);
  if (envLoaded) merged = deepMerge(merged, envLoaded);

  // Layer 4: global user config (~/.atk/)
  const globalPath = expandTilde(paths.global);
  if (debug) console.error(`[atk:config]   Searching ${globalPath}/`);

  for (const file of files) {
    const loaded = tryLoadFile(join(globalPath, file), debug, sources, false);
    if (loaded) merged = deepMerge(merged, loaded);
  }

  // Layer 5: local overrides (./)
  const localPath = expandTilde(paths.local);
  if (debug) console.error(`[atk:config]   Searching ${localPath}/`);

  for (const file of files) {
    const loaded = tryLoadFile(join(localPath, file), debug, sources, false);
    if (loaded) merged = deepMerge(merged, loaded);
  }

  // Layer 6: appName-specific global + local config
  if (appName) {
    const globalApp = tryLoadFile(join(globalPath, appName), debug, sources, false);
    if (globalApp) merged = deepMerge(merged, globalApp);

    const localApp = tryLoadFile(join(localPath, appName), debug, sources, false);
    if (localApp) merged = deepMerge(merged, localApp);
  }

  return { merged, sources };
}
