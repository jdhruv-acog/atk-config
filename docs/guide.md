# atk-config — Complete Guide

- [Schema definition and type inference](#schema-definition-and-type-inference)
- [How file loading works](#how-file-loading-works)
- [Variable substitution](#variable-substitution)
- [Deep merge behavior](#deep-merge-behavior)
- [The `baseConfig` option](#the-baseconfig-option)
- [Environment variables](#environment-variables)
- [The `overrides` option and Commander](#the-overrides-option-and-commander)
- [Global developer config (`appName`)](#global-developer-config-appname)
- [Validation](#validation)
- [Secrets management](#secrets-management)
- [Debugging](#debugging)
- [API reference](#api-reference)
- [Common issues](#common-issues)
- [LLM quick reference](#llm-quick-reference)

---

## Schema definition and type inference

The schema is the foundation of everything. It declares every config key, its type, its default, and which env var maps to it. **The return type of `config.get()` is automatically inferred from your schema — no separate TypeScript interface needed.**

```typescript
const config = await loadConfig({
  schema: {
    port: {
      doc: 'HTTP port',          // optional description
      format: 'port',            // validator and type (see formats below)
      default: 3000,             // fallback when no file or env var sets it
      env: 'PORT',               // environment variable that maps to this key
      sensitive: false,          // if true, masked in config.toString()
    },
  },
});

// Types are inferred automatically — no casting needed
const port: number = config.get('port');  // ✓ TypeScript knows this is number
```

Every field requires `format` and `default`. Everything else is optional.

Requires TypeScript 5.0+ for automatic inference. With TypeScript 4.x, use `as const` on your schema object.

### Formats and their inferred types

| Format | TypeScript type | Accepts |
|--------|----------------|---------|
| `'port'` | `number` | Integer 0–65535 |
| `'nat'` | `number` | Non-negative integer (0, 1, 2…) |
| `'int'` | `number` | Any integer |
| `'url'` | `string` | Valid URL string |
| `'email'` | `string` | Valid email string |
| `'ipaddress'` | `string` | IPv4 or IPv6 address |
| `String` | `string` | Any string |
| `Number` | `number` | Any number |
| `Boolean` | `boolean` | `true`/`false`, `"true"`/`"false"`, `1`/`0` |
| `Array` | `any[]` | Any array |
| `['a', 'b'] as const` | `'a' \| 'b'` | Enum — must be one of these exact values |

### Nested schemas

Group related keys under objects. The nesting is organizational only — it doesn't affect file loading.

```typescript
schema: {
  database: {
    host: { format: String,  default: 'localhost', env: 'DB_HOST' },
    port: { format: 'port',  default: 5432,        env: 'DB_PORT' },
    pool: {
      min: { format: 'nat',  default: 2,  env: 'DB_POOL_MIN' },
      max: { format: 'nat',  default: 10, env: 'DB_POOL_MAX' },
    },
  },
}
```

Access with dot notation — TypeScript infers the type at each path:

```typescript
config.get('database.pool.max')   // → number
config.get('database')            // → { host: string; port: number; pool: { min: number; max: number } }
config.get('typo.key')            // → TypeScript error at compile time
```

### Using `InferConfig` for explicit types

When you need the config type explicitly (e.g., for function parameter types):

```typescript
import type { InferConfig } from 'atk-config';

const schema = {
  port: { format: 'port', default: 3000 },
  database: { host: { format: String, default: 'localhost' } },
};

type AppConfig = InferConfig<typeof schema>;
// → { port: number; database: { host: string } }

function startServer(cfg: AppConfig) { ... }
startServer(config.getProperties()); // fully typed
```

---

## How file loading works

When you call `loadConfig`, sources are merged from lowest to highest priority:

```
 1. Schema default fields     — the default: value in each schema property
 2. baseConfig option         — flat object you provide in code
 3. ./config/{files}.*        — project config files (one per name in files[])
 4. ./config/{NODE_ENV}.*     — environment overlay (config dir only)
 5. ~/.atk/{files}.*          — global user config (one per name in files[])
 6. ./{files}.*               — local overrides (one per name in files[])
 7. ~/.atk/{appName}.*        — appName global (only if appName is set)
 8. ./{appName}.*             — appName local  (only if appName is set)
 9. Environment variables     — env: bindings in schema
10. overrides option          — highest priority, applied via config.set()
```

### The `files` option

`files` is an array of base file names to load. Default is `['config']`.

```typescript
await loadConfig({
  schema,
  files: ['common', 'app'],
  // loads, in order:
  //   ./config/common.*
  //   ./config/app.*
  //   ./config/{NODE_ENV}.*
  //   ~/.atk/common.*
  //   ~/.atk/app.*
  //   ./common.*
  //   ./app.*
});
```

Missing files are silently skipped. The `files` names apply to every layer (config dir, global, local) — but the NODE_ENV overlay is always a single file, only from the config dir.

### File format priority

When a base name is found, extensions are tried in this order: `.json` → `.yaml` → `.yml` → `.json5`. First match wins.

If multiple formats exist for the same base name, the library logs a warning to stderr and uses the first one (`.json` wins).

### Path defaults

| Path | Default | Purpose |
|------|---------|---------|
| `paths.config` | `./config` | Project config files and NODE_ENV overlay |
| `paths.global` | `~/.atk` | Per-developer global overrides |
| `paths.local` | `.` | Per-project local overrides (usually gitignored) |

Override any path with the `paths` option in `loadConfig`.

### Project structure

```
project/
├── config/
│   ├── config.yaml        ← base config (loaded by default)
│   ├── development.yaml   ← NODE_ENV=development overlay
│   ├── production.yaml    ← NODE_ENV=production overlay
│   └── testing.yaml       ← NODE_ENV=test overlay
└── src/
    └── config.ts
```

---

## Variable substitution

Config files support shell-like variable substitution. Substitution runs on the raw file text **before** YAML or JSON parsing.

```yaml
database:
  host:     ${DB_HOST:-localhost}
  password: "${DB_PASSWORD:?Database password required — set DB_PASSWORD}"
  url:      "postgresql://${DB_HOST:-localhost}:5432/mydb"
```

### Syntax

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Value of VAR if set; empty string `""` if not set |
| `${VAR:-default}` | Value of VAR if set and non-empty; `default` otherwise |
| `${VAR:?message}` | Value of VAR if set and non-empty; throws with `message` otherwise |

Variable names can be uppercase or lowercase: `${DB_HOST}` and `${db_host}` both work.

### Important: YAML parsing and empty values

Substitution produces text, which YAML then parses. An unquoted empty substitution becomes YAML `null`:

```yaml
password: ${DB_PASSWORD:-}    # → password: (empty) → YAML null → validation fails
password: "${DB_PASSWORD:-}"  # → password: ""      → empty string → correct
```

**Always quote optional values that might be empty.**

### Where substitution runs

Substitution runs on the entire raw file, including YAML comments. Don't put `${...}` patterns inside YAML comments.

### Error messages

`:?` errors include the file path: `Database password required — set DB_PASSWORD in config/config.yaml`.

---

## Deep merge behavior

When multiple files exist, they're deep merged in priority order. Later layers win.

### Objects merge recursively

```yaml
# config/config.yaml
database:
  host: localhost
  port: 5432

# config/production.yaml
database:
  host: prod.db.example.com   # only host is overridden

# Result: { host: 'prod.db.example.com', port: 5432 }
```

### Arrays replace entirely

Arrays are **replaced**, not concatenated:

```yaml
# Layer 1
servers: [a, b, c]

# Layer 2
servers: [d]

# Result: [d]  — NOT [a, b, c, d]
```

### Type changes: object → scalar

If a layer replaces an object with a scalar, the scalar wins — but your schema will likely catch it:

```yaml
# config/config.yaml
database:
  pool:
    min: 2
    max: 10

# config/production.yaml
database:
  pool: 5   ← replaces the entire pool object with a scalar
```

After merge, `database.pool` is `5`. If the schema expects `pool` to be a nested object, validation throws with a clear error pointing at the key. In strict mode, `database.pool` as a flat key is also flagged as unknown.

---

## The `baseConfig` option

`baseConfig` is a plain object that acts as a programmatic base layer. It's merged before any files, so config files can override it.

```typescript
const config = await loadConfig({
  schema: { port: { format: 'port', default: 3000 } },
  baseConfig: { port: 4000 },
});
// Priority for port:
//   schema default=3000 → baseConfig sets 4000 → config file can override
```

**When to use it:** When you have defaults that come from code at runtime — computed values, environment detection, or values that aren't known at schema-definition time.

**When not to use it:** If your defaults are static, put them in the schema `default` field. `baseConfig` is for values that need to be set programmatically before file loading.

The object can be nested to any depth:

```typescript
baseConfig: {
  database: { host: 'localhost', port: 5432 },
  logLevel: 'info',
}
```

---

## Environment variables

Map an environment variable to a schema key with the `env:` field:

```typescript
schema: {
  port: { format: 'port', default: 3000, env: 'PORT' },
}
```

```bash
PORT=8080 bun index.ts   # config.get('port') → 8080
```

Env vars are the second-highest priority layer — they override everything except `overrides`. There is no prefix system. Each key maps to exactly one env var, declared explicitly. This keeps the schema self-documenting.

---

## The `overrides` option and Commander

`overrides` is the highest-priority layer. It's a plain object applied via direct `config.set()` calls after all files and env vars are loaded.

```typescript
const config = await loadConfig({
  schema,
  overrides: { port: 9000 },  // wins over everything
});
```

### How undefined and unknown keys are handled

- **Undefined values are ignored.** `{ port: undefined }` doesn't override the config file value.
- **Unknown keys are silently ignored.** Keys not in the schema don't cause errors.
- **Nested objects are flattened.** `{ database: { host: 'x' } }` becomes `{ 'database.host': 'x' }` before applying. Only the specified keys change — sibling keys are untouched.

### Commander pattern

```typescript
import { Command } from 'commander';
import { loadConfig } from 'atk-config';

const program = new Command()
  .option('--log-level <level>', 'Log level');

program
  .command('serve')
  .option('--port <n>', 'Port', Number)
  .option('--host <host>', 'Host')
  .action(async (commandOpts) => {
    const config = await loadConfig({
      schema,
      overrides: {
        ...program.opts(),    // global CLI flags (logLevel, etc.)
        ...commandOpts,       // subcommand flags (port, host, etc.)
      },
    });
    // Flags the user passed: override config files
    // Flags not passed: config file / env var value used instead
  });

program.parse();
```

### Naming convention

For Commander opts to map automatically, **CLI-overridable schema keys must be top-level and camelCase**:

```
--log-level → opts.logLevel → schema key logLevel  ✓
--port      → opts.port     → schema key port       ✓
```

Deeply nested schema keys (`database.host`) are not directly CLI-overridable. Use env vars (`DB_HOST`) for those. CLI flags are for runtime tunables; infrastructure config belongs in files.

---

## Global developer config (`appName`)

When `appName` is set, the loader automatically loads `~/.atk/{appName}.yaml` and `./{appName}.yaml` as additional layers above the regular files.

```typescript
const config = await loadConfig({
  appName: 'my-api',
  schema,
});
// Also loads ~/.atk/my-api.yaml and ./my-api.yaml (if they exist)
```

**Developer workflow:** Each developer creates `~/.atk/my-api.yaml` once:

```yaml
# ~/.atk/my-api.yaml — personal settings, never committed
logLevel: debug
database:
  host: localhost
```

These overrides are:
- **Personal** — not committed to git
- **Global** — apply across all checkouts and branches of this project
- **Automatic** — no env vars to set, no per-project files to create

New developers get sensible defaults from the project's config files. They customize their `~/.atk/{appName}.yaml` as needed.

---

## Validation

Validation runs automatically when `loadConfig` completes. If anything is invalid, `loadConfig` throws before returning — the returned config is always safe to use.

```typescript
const config = await loadConfig({ schema });
// throws here if invalid — the next line only runs on success

config.get('port');  // safe
```

Error messages name the specific key and constraint:

```
Configuration validation failed:
  port: Value "99999" violates the constraint: must be between 0 and 65535
  logLevel: Value "verbose" must be one of ["debug","info","warn","error"]
```

### Strict mode

By default, unknown keys in config files generate a warning. With `strict: true`, they throw:

```typescript
const config = await loadConfig({
  schema: { port: { format: 'port', default: 3000 } },
  strict: true,
});
// throws if ./config/config.yaml has any key not in the schema
```

Error message includes the offending key name: `Unknown configuration key "typoKeu"`.

Use strict mode in production to catch typos and stale config keys.

### Deferring validation

```typescript
const config = await loadConfig({
  schema,
  skipValidation: true,  // does not auto-validate
});

// Inspect merged values before validation
console.log(config.getProperties());

// Validate explicitly when ready
config.validate();                       // uses strict option from loadConfig
config.validate({ allowed: 'strict' }); // override for this call only
config.validate({ allowed: 'warn' });   // override for this call only
```

---

## Secrets management

Never commit secrets to config files.

### Required env vars

Declare secrets as required directly in config files:

```yaml
# config/config.yaml
database:
  password: "${DB_PASSWORD:?Set DB_PASSWORD before starting}"
```

The app won't start if `DB_PASSWORD` isn't set — and the error message tells the developer exactly what to do.

### Async secret fetching

`loadConfig` is async specifically to support pre-fetching secrets:

```typescript
const [dbPassword, apiKey] = await Promise.all([
  fetchSecret('db/password'),
  fetchSecret('api/key'),
]);

const config = await loadConfig({
  schema: {
    dbPassword: { format: String, default: dbPassword, sensitive: true },
    apiKey:     { format: String, default: apiKey,     sensitive: true },
  },
});
```

`sensitive: true` masks the value in `config.toString()` output, preventing log leakage.

### Gitignored local file

```yaml
# ./config.yaml (gitignored)
database:
  password: dev_password_123
```

Add to `.gitignore`:
```
config.yaml
*.local.yaml
```

---

## Debugging

```bash
DEBUG=atk:config bun index.ts
```

Or `debug: true` in options. Output goes to stderr.

```
[atk:config] ─── Loading configuration ───────────────────
[atk:config] NODE_ENV  : production
[atk:config] files     : common, app
[atk:config] appName   : my-api
[atk:config] strict    : true
[atk:config]   Applied baseConfig
[atk:config]   Searching ./config/
[atk:config]   Loaded config/common.yaml
[atk:config]   Loaded config/app.yaml
[atk:config]   Loaded config/production.yaml
[atk:config]   Searching /Users/you/.atk/
[atk:config]   Loaded /Users/you/.atk/my-api.yaml
[atk:config]   Overrides applied: port, logLevel
[atk:config] Sources  : config/common.yaml, config/app.yaml, ...
[atk:config] Validating...
[atk:config] ✓ Validation passed
[atk:config] ─────────────────────────────────────────────
```

The `DEBUG` env var also accepts a comma-separated list: `DEBUG=express:router,atk:config`.

```typescript
config.getSources()
// ['config/common.yaml', 'config/app.yaml', '/Users/you/.atk/my-api.yaml']
```

---

## API reference

### `loadConfig(options)`

```typescript
interface LoadConfigOptions<S = any> {
  schema: S;                       // required — convict-style schema definition

  files?: string[];                // file base names to load. Default: ['config']
  baseConfig?: Record<string, any>; // programmatic base layer, below config files
  overrides?: Record<string, any>; // highest-priority layer, above env vars
                                   // nested objects are flattened to dot-notation paths

  appName?: string;                // enables ~/.atk/{appName}.* and ./{appName}.*
  paths?: {
    config?: string;               // default: './config'
    global?: string;               // default: '~/.atk'
    local?: string;                // default: '.'
  };

  strict?: boolean;                // unknown keys throw (default: false, warns only)
  skipValidation?: boolean;        // skip auto-validation (default: false)
  debug?: boolean;                 // verbose output to stderr (default: false)
}
```

Returns `Promise<ConfigInstance<InferConfig<S>>>`. Throws if validation fails (unless `skipValidation: true`).

### `config.get(key)`

Returns the value at a dot-notation path. Return type is inferred from the schema.

```typescript
config.get('port')              // number
config.get('database.host')     // string
config.get('database.pool.max') // number
config.get('database')          // { host: string; pool: { min: number; max: number } }
```

Typos in the key path are caught at compile time (TypeScript 5.0+).

### `config.getProperties()`

Returns the entire config as a typed plain object.

```typescript
const all = config.getProperties();
// { port: 3000, database: { host: 'localhost', pool: { min: 2, max: 10 } } }
```

### `config.getSources()`

Returns file paths actually loaded, in merge order. Does not include env vars or programmatic overrides.

```typescript
config.getSources()
// ['config/config.yaml', '/Users/you/.atk/my-api.yaml']
```

### `config.validate(opts?)`

Validates against the schema. Called automatically unless `skipValidation: true`.

```typescript
config.validate()
config.validate({ allowed: 'strict' })  // force strict for this call
config.validate({ allowed: 'warn' })    // force warn for this call
```

### `config.toString()`

Returns config as a JSON string. Values marked `sensitive: true` are masked.

### `config.has(path)`

Check whether a dot-notation path exists in the schema.

---

## Common issues

### "Configuration param not declared in schema"

A config file has a key that's not in the schema. Either add it to the schema, remove it from the file, or remove `strict: true`.

### Pool/object overridden by scalar

```yaml
# config/config.yaml
database:
  pool: { min: 2, max: 10 }

# config/production.yaml
database:
  pool: 5    ← replaces the entire object
```

After merge, `database.pool` is `5` but the schema expects an object. Convict throws: `missing from config, did you override its parent?`. Fix: keep structure consistent across layers.

### Arrays not combining

Arrays replace — they don't merge. If you need to extend an array, define the full value in a single layer.

### Empty optional value parses as null

```yaml
password: ${DB_PASSWORD:-}  # → empty string after substitution → YAML null
```

Fix: quote it: `"${DB_PASSWORD:-}"`.

### Commander option doesn't override config

The schema key must exactly match Commander's camelCase name. `--log-level` → `opts.logLevel` → schema key must be `logLevel`. Check for mismatches in naming.

### TypeScript 4.x — types show as `any`

The automatic type inference requires TypeScript 5.0+. With TypeScript 4.x, use `as const` on your schema object to get types:

```typescript
const schema = {
  port: { format: 'port', default: 3000 },
} as const;

const config = await loadConfig({ schema });
```

---

## LLM quick reference

This section is a compact specification for LLMs (language models, agents) working with atk-config.

### Schema field spec

```typescript
{
  keyName: {
    format: 'port' | 'nat' | 'int' | 'url' | 'email' | 'ipaddress'
          | String | Number | Boolean | Array | ['a', 'b'] as const,
    default: <value>,          // required — type must match format
    env?: 'ENV_VAR_NAME',      // optional env var binding
    doc?: 'description',       // optional human-readable description
    sensitive?: boolean,       // optional — masks value in toString()
  }
}
```

Schemas can be arbitrarily nested. Access nested keys with dot notation.

### `loadConfig` options quick spec

```typescript
await loadConfig({
  schema,                    // required
  files: ['config'],         // file base names; default ['config']
  baseConfig: {},            // base layer below files
  overrides: {},             // top layer above env vars; undefined/unknown keys ignored; nested objects flattened
  appName: 'name',           // enables ~/.atk/{name}.* and ./{name}.*
  paths: { config, global, local },  // override search dirs
  strict: false,             // true → unknown keys throw
  skipValidation: false,     // true → don't auto-validate
  debug: false,              // true → verbose stderr output
})
```

### Loading order (unambiguous numbered list)

1. `schema.default` fields (convict internal baseline)
2. `baseConfig` option (merged as base before files)
3. `./config/{files[0]}.*`, `./config/{files[1]}.*`, … (in files[] order)
4. `./config/{NODE_ENV}.*`
5. `~/.atk/{files[0]}.*`, `~/.atk/{files[1]}.*`, …
6. `./{files[0]}.*`, `./{files[1]}.*`, …
7. `~/.atk/{appName}.*` (only if appName set)
8. `./{appName}.*` (only if appName set)
9. Env vars via `env:` bindings in schema
10. `overrides` option

### Variable substitution spec

Applies to raw file content before parsing. Regex: `${[A-Za-z0-9_]+}` with optional `:-` or `:?` operator.

- `${VAR}` → env value if set, `""` if not set
- `${VAR:-default}` → env value if set and non-empty, `default` otherwise
- `${VAR:?msg}` → env value if set and non-empty, throws `Error(msg + " in " + filePath)` otherwise
- `${VAR:?}` → throws with default message `Required environment variable VAR is not set`

### Deep merge rules

- Objects: recursively merged (later layer overrides specific keys)
- Arrays: replaced entirely (not concatenated)
- Any other type change: later layer wins

### Commander integration pattern

```typescript
overrides: { ...program.opts(), ...commandOpts }
```

Rules:
- `undefined` values in overrides are ignored (user didn't pass the flag → use file/env value)
- Unknown keys in overrides are ignored (Commander internals don't cause errors)
- Nested objects are flattened: `{ database: { host: 'x' } }` → `{ 'database.host': 'x' }`
- Schema keys must be top-level camelCase to match Commander's `opts` object

### Type inference

`config.get('key')` return types are inferred from the schema automatically (TypeScript 5.0+):

| Schema format | TypeScript type |
|--------------|----------------|
| `'port'` / `'nat'` / `'int'` | `number` |
| `'url'` / `'email'` / `'ipaddress'` | `string` |
| `String` | `string` |
| `Number` | `number` |
| `Boolean` | `boolean` |
| `Array` | `any[]` |
| `['a', 'b'] as const` | `'a' \| 'b'` |
| Nested namespace | object type |

### `config` instance methods

```typescript
config.get('dotted.key')        // → inferred type from schema
config.getProperties()          // → full config as typed plain object
config.getSources()             // → string[] of loaded file paths
config.validate(opts?)          // → throws on invalid; opts: { allowed: 'strict'|'warn' }
config.toString()               // → JSON string with sensitive values masked
config.has('dotted.key')        // → boolean
```
