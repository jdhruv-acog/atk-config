# atk-config

A no-surprises config system for Node.js and Bun.

Define a schema once, and it takes care of loading, merging, and validating config from files, environment variables, and code with full type inference.

Read the [full guide](https://github.com/jdhruv-acog/atk-config/blob/main/docs/guide.md) and [examples](https://github.com/jdhruv-acog/atk-config/tree/main/examples). Requires TypeScript `5.0+`.

```bash
bun add atk-config
```
## Quick start

Define a schema, call `loadConfig`. That's it.

```ts
import { loadConfig } from 'atk-config';

const config = await loadConfig({
  schema: {
    port:     { format: 'port',   default: 3000,        env: 'PORT' },
    logLevel: { format: ['debug', 'info', 'warn', 'error'] as const,
                                  default: 'info',       env: 'LOG_LEVEL' },
    database: {
      host:   { format: String,   default: 'localhost',  env: 'DB_HOST' },
      port:   { format: 'port',   default: 5432,         env: 'DB_PORT' },
    },
  },
});

config.get('port')           // number  → 3000
config.get('database.host')  // string  → 'localhost'
config.getProperties()       // { port: number; logLevel: ...; database: { host: string; port: number } }
```

Drop a config file next to your code and values are picked up automatically:

```yaml
# config/config.yaml
port: 4000
database:
  host: my-db.internal
```

`loadConfig` throws if any value fails validation. The returned config object is always safe to use.

---

## Schema

Every key needs `format` and `default`. Everything else is optional.

```ts
{
  port: {
    format:    'port',          // validates and determines the TypeScript type
    default:   3000,            // used when nothing else sets the value
    env:       'PORT',          // environment variable that maps to this key
    doc:       'HTTP port',     // optional description
    sensitive: false,           // if true, value is masked in config.toString()
  }
}
```

Schemas nest arbitrarily. Access nested keys with dot notation — TypeScript infers the type at every path:

```ts
config.get('database.pool.max')   // number
config.get('database')            // { host: string; port: number; pool: { ... } }
config.get('typo.key')            // TypeScript error at compile time
```

### Formats

| Format | TypeScript type | Validates |
|--------|----------------|-----------|
| `'port'` | `number` | Integer 0–65535 |
| `'nat'` | `number` | Non-negative integer |
| `'int'` | `number` | Any integer |
| `'url'` | `string` | Valid URL |
| `'email'` | `string` | Valid email address |
| `'ipaddress'` | `string` | IPv4 or IPv6 |
| `String` | `string` | Any string |
| `Number` | `number` | Any number |
| `Boolean` | `boolean` | `true`/`false`, `"true"`/`"false"`, `1`/`0` |
| `Array` | `any[]` | Any array |
| `['a', 'b'] as const` | `'a' \| 'b'` | One of these exact values |

---

## Config files

### Default location

```
config/config.yaml
```

Supported formats: `.json` → `.yaml` → `.yml` → `.json5`. First match wins.

### Environment overlays

Put environment-specific values in a file named after `NODE_ENV`:

```
config/
├── config.yaml       ← base config, always loaded
├── development.yaml  ← merged on top when NODE_ENV=development
├── production.yaml   ← merged on top when NODE_ENV=production
└── test.yaml         ← merged on top when NODE_ENV=test
```

Objects merge recursively. Arrays replace entirely.

```yaml
# config/config.yaml
port: 3000
database:
  host: localhost
  pool: { min: 2, max: 10 }

# config/production.yaml
database:
  host: prod-db.internal   # overrides host, pool is untouched
```

### Multiple files

Load several files in order — useful for separating shared from app-specific config:

```ts
await loadConfig({
  schema,
  files: ['common', 'app'],
  // loads: config/common.yaml, then config/app.yaml, then config/{NODE_ENV}.yaml
});
```

---

## Resolution order

Sources merge in this order. Later layers win.

| # | Source | Active when |
|---|--------|-------------|
| 1 | Schema `default` values | always |
| 2 | `baseConfig` option | always |
| 3 | `./config/{files}.*` | always |
| 4 | `./config/{NODE_ENV}.*` | always |
| 5 | `~/.atk/{files}.*` | always |
| 6 | `~/.atk/{appName}.*` | only when `appName` is set |
| 7 | Environment variables | always |
| 8 | `overrides` option | always |

---

## Global config

The `~/.atk/` directory is the global config namespace — a place for settings that live outside your project and are never committed to git. It has two uses:

**Shared developer settings** (`~/.atk/config.yaml`) — any app that loads `files: ['config']` (the default) picks this up. Good for personal defaults like log level or debug flags that you want everywhere.

```yaml
# ~/.atk/config.yaml — applies to all your apps
logLevel: debug
```

**App-specific overrides** (`~/.atk/{appName}.yaml`) — when you set `appName`, a second file scoped to that app is loaded on top of the shared file. Good for database hosts, API endpoints, or anything that differs per-project but shouldn't be committed.

```ts
await loadConfig({
  schema,
  appName: 'my-api',
  // also loads ~/.atk/my-api.yaml
});
```

```yaml
# ~/.atk/my-api.yaml — personal settings for this app
database:
  host: localhost
```

Each developer on your team can have their own `~/.atk/my-api.yaml`. They never conflict because they never enter the repo.

---

## Environment variables

Bind env vars explicitly in the schema. There is no prefix system — each key maps to exactly one named variable:

```ts
schema: {
  port:     { format: 'port',   default: 3000, env: 'PORT' },
  database: {
    host:   { format: String, default: 'localhost', env: 'DB_HOST' },
  },
}
```

```bash
PORT=8080 DB_HOST=prod.db bun start
```

Env vars override config files (layer 7). Type coercion is automatic — `"8080"` becomes `8080`.

---

## Variable substitution in files

Config files support `${VAR}` syntax, resolved against environment variables before the file is parsed:

```yaml
database:
  host:     ${DB_HOST:-localhost}
  password: "${DB_PASSWORD:?Set DB_PASSWORD before starting}"
  url:      "postgresql://${DB_HOST:-localhost}:5432/mydb"
```

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Value of VAR, or empty string if unset |
| `${VAR:-default}` | Value of VAR, or `default` if unset or empty |
| `${VAR:?message}` | Value of VAR, or throws with `message` if unset or empty |

> **Note:** Unquoted empty substitutions become YAML `null`. Quote values that might be empty:
> `"${DB_PASSWORD:-}"` → `""` (correct) vs `${DB_PASSWORD:-}` → `null` (probably wrong)

---

## Overrides

The highest-priority layer. Pass values that should win over everything — env vars included:

```ts
await loadConfig({
  schema,
  overrides: { port: 9000, logLevel: 'debug' },
});
```

Three rules:
- `undefined` values are **ignored** — the layer below is used instead
- Unknown keys are **silently dropped** — no errors from Commander internals
- Nested objects are **flattened** — `{ database: { host: 'x' } }` sets only `database.host`, leaving siblings untouched

### Commander integration

Pass CLI flags directly as overrides. Flags the user didn't pass come through as `undefined` and are automatically ignored, so file and env values are used as fallbacks:

```ts
import { Command } from 'commander';
import { loadConfig } from 'atk-config';

const program = new Command()
  .option('--log-level <level>', 'Log level');

program
  .command('serve')
  .option('--port <n>', 'Port', Number)
  .action(async (opts) => {
    const config = await loadConfig({
      schema,
      overrides: {
        ...program.opts(),  // global flags
        ...opts,            // subcommand flags
      },
    });
  });
```

Schema keys must match Commander's camelCase names: `--log-level` → `logLevel`, `--port` → `port`.

---

## baseConfig

A programmatic base layer applied before any files. Useful for computed defaults that aren't known at schema-definition time:

```ts
const region = await detectRegion(); // async, determined at runtime

const config = await loadConfig({
  schema,
  baseConfig: { region, database: { host: `db.${region}.internal` } },
  // config files can still override these
});
```

Priority: schema defaults < `baseConfig` < config files < env vars < overrides.

---

## Validation

Validation runs automatically. `loadConfig` throws before returning if anything is invalid — the returned config is always safe to use:

```ts
const config = await loadConfig({ schema });
// if we get here, everything passed
```

**Strict mode** — unknown keys in config files throw instead of warn:

```ts
await loadConfig({ schema, strict: true });
// throws: Unknown configuration key "datbase.host" (typo caught)
```

**Defer validation** when you need to inspect values before validating:

```ts
const config = await loadConfig({ schema, skipValidation: true });
console.log(config.getProperties()); // inspect merged values
config.validate();                   // throws if anything is wrong
```

---

## Secrets

Never put secrets in committed config files. Two patterns:

**Required env var** — the app refuses to start if the secret is missing:

```yaml
# config/config.yaml
database:
  password: "${DB_PASSWORD:?Set DB_PASSWORD — see internal/secrets}"
```

**Pre-fetched from a vault** — fetch secrets before loading config, inject via schema defaults or `baseConfig`:

```ts
const dbPassword = await vault.get('db/password');

const config = await loadConfig({
  schema: {
    database: {
      password: { format: String, default: dbPassword, sensitive: true },
    },
  },
});
```

`sensitive: true` masks the value in `config.toString()` output so it doesn't appear in logs.

---

## Debugging

Enable verbose output to see exactly what was loaded and in what order:

```bash
DEBUG=atk:config bun start
```

Or pass `debug: true` to `loadConfig`. Output goes to stderr:

```
[atk:config] ─── Loading configuration ───────────────────
[atk:config] NODE_ENV  : development
[atk:config] files     : common, app
[atk:config] appName   : my-api
[atk:config]   Searching ./config/
[atk:config]   Loaded config/common.yaml
[atk:config]   Loaded config/app.yaml
[atk:config]   Loaded config/development.yaml
[atk:config]   Searching /Users/you/.atk/
[atk:config]   Loaded /Users/you/.atk/my-api.yaml
[atk:config]   Overrides applied: port
[atk:config] Sources  : config/common.yaml, config/app.yaml, ...
[atk:config] ✓ Validation passed
[atk:config] ─────────────────────────────────────────────
```

Inspect loaded sources in code:

```ts
config.getSources()
// ['config/common.yaml', 'config/app.yaml', '/Users/you/.atk/my-api.yaml']
```

---

## API

### `loadConfig(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schema` | object | — | Required. Convict-style schema definition |
| `files` | `string[]` | `['config']` | Base file names to load from each directory layer |
| `baseConfig` | object | — | Programmatic base layer, below config files |
| `overrides` | object | — | Highest-priority layer, above env vars |
| `appName` | string | — | Enables `~/.atk/{appName}.*` |
| `paths.config` | string | `'./config'` | Project config directory |
| `paths.global` | string | `'~/.atk'` | Global developer config directory |
| `strict` | boolean | `false` | Unknown keys throw instead of warn |
| `skipValidation` | boolean | `false` | Skip automatic validation |
| `debug` | boolean | `false` | Verbose output to stderr |

Returns `Promise<ConfigInstance<T>>`. Throws if validation fails (unless `skipValidation: true`).

### `config` instance

```ts
config.get('database.host')   // typed value at dot-notation path
config.getProperties()        // entire config as a typed plain object
config.getSources()           // string[] of file paths actually loaded, in order
config.validate()             // throws if invalid; call manually when skipValidation: true
config.toString()             // JSON string with sensitive values masked
config.has('database.host')   // boolean — whether the path exists in the schema
```

### `InferConfig` utility type

When you need the config type for function parameters or other explicit annotations:

```ts
import type { InferConfig } from 'atk-config';

const schema = { port: { format: 'port', default: 3000 } };
type AppConfig = InferConfig<typeof schema>;  // { port: number }

function startServer(cfg: AppConfig) { ... }
startServer(config.getProperties());
```
