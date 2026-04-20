// ─── Format → value type inference ───────────────────────────────────────────

/**
 * Maps a convict format specifier to its TypeScript value type.
 * Handles constructors (String, Number, Boolean, Array), named formats
 * ('port', 'nat', 'url', etc.), and enum arrays (['a', 'b'] as const).
 */
type InferLeaf<F> =
  F extends typeof String  ? string  :
  F extends typeof Number  ? number  :
  F extends typeof Boolean ? boolean :
  F extends typeof Array   ? any[]   :
  F extends 'port' | 'nat' | 'int'           ? number :
  F extends 'url' | 'email' | 'ipaddress'    ? string :
  F extends readonly (infer E)[]             ? E      :
  any;

/**
 * Derives the config value shape from a schema definition object.
 *
 * A schema leaf is any object with both `format` and `default` properties.
 * Everything else is treated as a nested namespace and recursed into.
 *
 * Usage: InferConfig<typeof schema> → { port: number; database: { host: string } }
 */
export type InferConfig<S> = {
  [K in keyof S]:
    S[K] extends { format: infer F; default: any }
      ? InferLeaf<F>
      : S[K] extends object
      ? InferConfig<S[K]>
      : never;
};

// ─── Dot-notation path types ──────────────────────────────────────────────────

/**
 * All valid dot-notation key paths in T, including intermediate objects.
 * e.g. { database: { host: string } } → 'database' | 'database.host'
 */
type DeepPaths<T> = T extends object
  ? {
      [K in keyof T & string]:
        T[K] extends object ? K | `${K}.${DeepPaths<T[K]>}` : K;
    }[keyof T & string]
  : string;

/**
 * Resolves the value type at a dot-notation path K within T.
 * Returns `never` for paths that don't exist.
 */
type DeepGet<T, K extends string> =
  K extends keyof T
    ? T[K]
    : K extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T
      ? T[Head] extends object
        ? DeepGet<T[Head], Tail>
        : never
      : never
    : never;

// ─── Public API types ─────────────────────────────────────────────────────────

export interface LoadConfigOptions<S = any> {
  /** Convict-style schema definition. Type is inferred automatically — no separate interface needed. */
  schema: S;

  /** Base names of config files to load. Default: ['config']. Extensions tried in order: .json, .yaml, .yml, .json5. */
  files?: string[];

  /**
   * Base-layer config object merged before any files load.
   * Priority: schema `default` < baseConfig < config files < env vars < overrides.
   * Use for programmatic defaults that aren't known at schema-definition time.
   */
  baseConfig?: Record<string, any>;

  /**
   * Highest-priority layer, applied after all files and env vars.
   * Pass Commander's `program.opts()` here for CLI integration.
   * - Undefined values are silently ignored (flag not passed → file value used)
   * - Unknown keys are silently ignored (Commander internals won't cause errors)
   * - Nested objects are supported — they are flattened to dot-notation paths before being applied
   */
  overrides?: Record<string, any>;

  /** Custom directory paths. Defaults: config='./config', global='~/.atk' */
  paths?: {
    config?: string;
    global?: string;
  };

  /** App name for per-developer global config. Loads ~/.atk/{appName}.* */
  appName?: string;

  /** Throw on unknown keys in config files. Default: false (warns only). */
  strict?: boolean;

  /** Skip automatic validation after load. Call config.validate() manually when ready. Default: false. */
  skipValidation?: boolean;

  /** Enable verbose loading output to stderr. Also enabled by DEBUG=atk:config. */
  debug?: boolean;
}

export interface ConfigPaths {
  config: string;
  global: string;
}

/**
 * A fully loaded, validated config instance.
 * T is the inferred value shape derived from the schema.
 */
export interface ConfigInstance<T = any> {
  /**
   * Get a config value by dot-notation path.
   * Return type is inferred from the schema — no casting needed.
   */
  get<K extends DeepPaths<T>>(key: K): DeepGet<T, K & string>;

  /** Returns the entire config as a typed plain object. Useful for spreading or passing config around. */
  getProperties(): T;

  /** Returns file paths that were actually loaded, in merge order. Does not include env vars or overrides. */
  getSources(): string[];

  /**
   * Validates config against the schema. Called automatically unless skipValidation was set.
   * Throws with a clear message listing every violation.
   */
  validate(opts?: { allowed?: 'strict' | 'warn' }): this;

  /** Returns config as a JSON string. Values marked sensitive: true are masked as "[Sensitive]". */
  toString(): string;

  /** Check whether a dot-notation path exists in the schema. */
  has(path: string): boolean;
}
