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

// Return types are inferred from the schema — no casting, no manual interface
const port: number = config.get('port');           // number
const host: string = config.get('database.host'); // string
```

`loadConfig` throws if any value fails validation. Config is always safe to use immediately.

## How values are resolved

From lowest to highest priority:

| # | Source | Default path |
|---|--------|-------------|
| 1 | Schema `default` field | — |
| 2 | `baseConfig` option | — |
| 3 | Config files | `./config/config.*` |
| 4 | NODE_ENV overlay | `./config/{NODE_ENV}.*` |
| 5 | Global user config | `~/.atk/config.*` |
| 6 | Local overrides | `./config.*` |
| 7 | `appName` global _(if set)_ | `~/.atk/{appName}.*` |
| 8 | `appName` local _(if set)_ | `./{appName}.*` |
| 9 | Environment variables | `env:` field in schema |
| 10 | `overrides` option | — |

Paths in the table assume the default `files: ['config']`. File formats tried in order: `.json` → `.yaml` → `.yml` → `.json5`. Missing files are silently skipped.

## Config files

Create `./config/config.yaml` with values to override schema defaults:

```yaml
port: 4000
logLevel: debug
database:
  host: my-db.internal
```

`NODE_ENV=production` automatically merges `./config/production.yaml` on top. Use `files: ['common', 'app']` to load multiple files in sequence.

## Variable substitution

Reference env vars directly in config files. Substitution runs before parsing:

```yaml
database:
  host:     ${DB_HOST:-localhost}
  password: "${DB_PASSWORD:?Set DB_PASSWORD before starting}"
  url:      "postgresql://${DB_HOST:-localhost}:5432/mydb"
```

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Value of VAR, or `""` if unset |
| `${VAR:-default}` | Value of VAR, or `default` if unset or empty |
| `${VAR:?message}` | Value of VAR, or **throws** with `message` if unset or empty |

Quote values that might be empty (`"${DB_PASSWORD:-}"`) — bare empty substitutions parse as YAML `null`.

## `baseConfig` option

A plain object that acts as the base layer below config files. Useful for programmatic defaults:

```typescript
const config = await loadConfig({
  schema: { port: { format: 'port', default: 3000 } },
  baseConfig: { port: 4000 },
  // schema default=3000 → baseConfig sets 4000 → config files can still override
});
```

## Commander integration

Pass `program.opts()` as `overrides`. Undefined options (flags not passed) are ignored. Unknown keys (Commander internals) are silently dropped. Nested objects are supported.

```typescript
program.command('serve')
  .option('--port <n>', 'Port', Number)
  .option('--host <host>', 'Host')
  .action(async (commandOpts) => {
    const config = await loadConfig({
      schema,
      overrides: { ...program.opts(), ...commandOpts },
      // only flags the user actually passed override config files
    });
  });

program.parse();
```

CLI-overridable keys must be **top-level and camelCase** to match Commander's naming (`--log-level` → `logLevel`).

## Global developer config (`appName`)

```typescript
const config = await loadConfig({ appName: 'my-api', schema });
```

Each developer creates `~/.atk/my-api.yaml` once with personal settings — log level, local DB host, debug flags. The project picks it up automatically. Nothing to commit, nothing to configure per checkout.

## Debugging

```bash
DEBUG=atk:config bun index.ts
```

Prints every file searched, loaded, and skipped, with the exact merge order. Also available as `debug: true` in options.

```typescript
config.getSources()
// ['config/config.yaml', '/Users/you/.atk/my-api.yaml']
```

## Full reference

See [docs/guide.md](./docs/guide.md) for complete schema format, deep merge rules, strict mode, secrets management, API reference, and LLM quick reference.
