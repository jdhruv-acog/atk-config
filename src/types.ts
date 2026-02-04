import type { Config, Schema } from 'convict';

export interface LoadConfigOptions<T = any> {
  schema: Schema<T>;
  files?: string[];
  defaults?: Record<string, any>;
  paths?: {
    config?: string;
    global?: string;
    local?: string;
  };
  appName?: string;
  strict?: boolean;
  debug?: boolean;
}

export interface ConfigPaths {
  config: string;
  global: string;
  local: string;
}

export type ConfigInstance<T = any> = Config<T>;
