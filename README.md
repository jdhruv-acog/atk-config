# atk-config

Schema-validated hierarchical configuration for Node.js and Bun.
Requires TypeScript 5.0+ for full type inference.

## Install

```bash
bun add atk-config
```

## Quick start

```typescript
import { loadConfig } from 'atk-config';

const config = await loadConfig({
  schema: {
    port:     { format: 'port', default: 3000, env: 'PORT' },
    logLevel: { format: ['debug', 'info', 'warn', 'error'] as const, default: 'info', env: 'LOG_LEVEL' },
    database: {
      host: { format: String, default: 'localhost', env: 'DB_HOST' },
      port: { format: 'port', default: 5432,        env: 'DB_PORT' },
    },
  },
});

// Types inferred from the schema — no casting, no manual interface
const port: number = config.get('port');
const host: string = config.get('database.host');
```

`loadConfig` throws if any value fails validation. Config is always safe to use immediately.

## Schema format

Each leaf key is a field descriptor. Schemas can be arbitrarily nested; access nested values with dot notation.

```typescript
{
  keyName: {
    format: 'port' | 'nat' | 'int' | 'url' | 'email' | 'ipaddress'
          | String | Number | Boolean | Array | ['a', 'b'] as const,
    default: <value>,        // required — type must match format
    env?: 'ENV_VAR_NAME',    // bind to an environment variable
    doc?: 'description',     // human-readable label
    sensitive?: true,        // masks the value in toString()
  }
}
```

| Format | TypeScript type |
|--------|----------------|
| `'port'` / `'nat'` / `'int'` | `number` |
| `'url'` / `'email'` / `'ipaddress'` | `string` |
| `String` | `string` |
| `Number` | `number` |
| `Boolean` | `boolean` |
| `Array` | `any[]` |
| `['a', 'b'] as const` | `'a' \| 'b'` |
| Nested namespace | object type |

## Priority order

Values are resolved from lowest to highest priority:

| # | Source | Default path |
|---|--------|-------------|
| 1 | Schema `default` field | — |
| 2 | `baseConfig` option | — |
| 3 | Config files | `./config/{files}.*` |
| 4 | NODE_ENV overlay | `./config/{NODE_ENV}.*` |
| 5 | Global user config | `~/.atk/{files}.*` |
| 6 | Local overrides | `./{files}.*` |
| 7 | `appName` global _(if set)_ | `~/.atk/{appName}.*` |
| 8 | `appName` local _(if set)_ | `./{appName}.*` |
| 9 | Environment variables | `env:` field in schema |
| 10 | `overrides` option | — |

File formats tried in order: `.json` → `.yaml` → `.yml` → `.json5`. Missing files are silently skipped.

## Config files

Create `./config/config.yaml` (or `.json`, `.json5`) to override schema defaults:

```yaml
port: 4000
logLevel: debug
database:
  host: my-db.internal
```

`NODE_ENV=production` automatically merges `./config/production.yaml` on top. Use `files: ['common', 'app']` to load multiple base files in order.

## Variable substitution

Env var references in config files are substituted before parsing:

```yaml
database:
  host:     ${DB_HOST:-localhost}
  password: "${DB_PASSWORD:?Set DB_PASSWORD before starting}"
  url:      "postgresql://${DB_HOST:-localhost}:5432/mydb"
```

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Env value, or `""` if unset |
| `${VAR:-default}` | Env value if set and non-empty, `default` otherwise |
| `${VAR:?message}` | Env value if set and non-empty, **throws** with `message` otherwise |

Quote values that might be empty (`"${DB_PASSWORD:-}"`) — bare empty substitutions parse as YAML `null`.

## `baseConfig` option

A plain object loaded below config files. Useful for programmatic defaults that can still be overridden by files:

```typescript
const config = await loadConfig({
  schema: { port: { format: 'port', default: 3000 } },
  baseConfig: { port: 4000 },
  // schema default=3000 → baseConfig=4000 → config file can still override
});
```

## Commander integration

Pass `program.opts()` as `overrides`. Flags the user didn't pass are `undefined` and automatically ignored, so file and env values still apply:

```typescript
program.command('serve')
  .option('--port <n>', 'Port', Number)
  .option('--host <host>', 'Host')
  .action(async (commandOpts) => {
    const config = await loadConfig({
      schema,
      overrides: { ...program.opts(), ...commandOpts },
    });
  });

program.parse();
```

Rules:
- `undefined` override values are ignored — file/env value is used instead
- Unknown keys (Commander internals) are silently dropped
- Nested objects are flattened: `{ database: { host: 'x' } }` → sets `database.host` only, siblings untouched
- CLI-overridable schema keys should be top-level camelCase to match Commander (`--log-level` → `logLevel`)

## Global developer config (`appName`)

```typescript
const config = await loadConfig({ appName: 'my-api', schema });
```

Each developer creates `~/.atk/my-api.yaml` once with personal settings — log level, local DB host, debug flags. The project picks it up automatically. Nothing to commit, nothing to configure per checkout.

## Debugging

```bash
DEBUG=atk:config bun index.ts
```

Prints every file searched, loaded, and skipped with the exact merge order. Also available as `debug: true` in options.

```typescript
config.getSources()
// ['config/config.yaml', '/Users/you/.atk/my-api.yaml']
```

## Full reference

See [docs/guide.md](./docs/guide.md) for deep merge rules, strict mode, secrets management, and the complete API reference.

---

## Quick reference

Compact spec for fast lookup.

### `loadConfig` options

```typescript
await loadConfig({
  schema,                              // required
  files?: ['config'],                  // base file names; default ['config']
  baseConfig?: {},                     // base layer below config files
  overrides?: {},                      // highest priority; undefined/unknown keys ignored; nested objects flattened
  appName?: 'name',                    // enables ~/.atk/{name}.* and ./{name}.*
  paths?: { config, global, local },   // override default search directories
  strict?: false,                      // true → unknown keys in files throw
  skipValidation?: false,              // true → skip auto-validation on load
  debug?: false,                       // true → verbose stderr output
})
```

### `config` instance API

```typescript
config.get('dotted.key')        // → inferred type from schema
config.getProperties()          // → full config as typed plain object
config.getSources()             // → string[] of loaded file paths (copy)
config.validate(opts?)          // → throws on invalid; opts: { allowed: 'strict'|'warn' }
config.toString()               // → JSON string; sensitive values masked as "[Sensitive]"
config.has('dotted.key')        // → boolean; true for both leaf keys and namespace nodes
```

### Variable substitution spec

Applied to raw file content before parsing. Variable names: `[A-Za-z0-9_]+`.

- `${VAR}` → env value if set, `""` if not
- `${VAR:-default}` → env value if set and non-empty, `default` otherwise
- `${VAR:?msg}` → env value if set and non-empty, throws `Error(msg + " in " + filePath)` otherwise
- `${VAR:?}` → throws with default message `Required environment variable VAR is not set`

### Deep merge rules

- Objects merge recursively — later layer overrides specific keys, siblings untouched
- Arrays replace entirely — no concatenation
- All other type changes — later layer wins
