# atk-config

Schema-validated hierarchical configuration for Node.js and Bun.
Requires TypeScript 5.0+ for full type inference.

---

## Install

```bash
bun add atk-config
```

---

## Quick start

```ts
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

config.get('port');            // number
config.get('database.host');   // string
```

Optional config file:

```yaml
# config/config.yaml
port: 4000
database:
  host: my-db.internal
```

Run:

```bash
PORT=5000 bun index.ts
```

Resolution order (simplified):

```
default → config files → env → overrides
```

`loadConfig` throws on invalid values. Returned config is always safe to use.

---

## Schema

Each key defines type, default, and optional env binding.

```ts
{
  key: {
    format: 'port' | 'nat' | 'int' | 'url' | 'email' | 'ipaddress'
          | String | Number | Boolean | Array | ['a', 'b'] as const,
    default: <value>,
    env?: 'ENV_VAR',
    doc?: 'description',
    sensitive?: true,
  }
}
```

* `format` defines validation + TypeScript type
* `default` is required and must match the format
* schemas can be nested arbitrarily

Types are inferred automatically:

```ts
config.get('port')          // number
config.get('database.host') // string
```

---

## Config files

Default location:

```
./config/config.yaml
```

Environment overlay:

```
NODE_ENV=production → ./config/production.yaml
```

Multiple files:

```ts
await loadConfig({
  schema,
  files: ['common', 'app'],
});
```

Files are loaded in order and merged.

Supported formats:

```
.json → .yaml → .yml → .json5
```

First match wins.

---

## Environment variables

Bind explicitly in schema:

```ts
port: { format: 'port', default: 3000, env: 'PORT' }
```

Env values override config files.

---

## Merging behavior

* objects merge recursively
* arrays replace (not concatenated)
* later layers override earlier ones

---

## Overrides (highest priority)

```ts
await loadConfig({
  schema,
  overrides: { port: 9000 },
});
```

Rules:

* `undefined` values are ignored
* unknown keys are ignored
* nested objects are flattened

---

## baseConfig

Programmatic defaults applied before files:

```ts
await loadConfig({
  schema,
  baseConfig: { port: 4000 },
});
```

Use for runtime-derived defaults.

---

## Validation

Runs automatically on load.

```ts
await loadConfig({ schema }); // throws if invalid
```

Strict mode:

```ts
await loadConfig({
  schema,
  strict: true,
});
```

Unknown keys now throw instead of warn.

---

## Debugging

```bash
DEBUG=atk:config bun index.ts
```

Shows:

* files searched and loaded
* merge order
* applied layers

```ts
config.getSources()
```

---

## Variable substitution

In config files:

```yaml
database:
  host: ${DB_HOST:-localhost}
  password: "${DB_PASSWORD:?Required}"
```

* `${VAR}` → value or empty
* `${VAR:-default}` → fallback
* `${VAR:?msg}` → throw if missing

Runs before parsing.

---

## Commander integration

```ts
overrides: {
  ...program.opts(),
  ...commandOpts,
}
```

* CLI flags override config
* missing flags fall back to file/env values
* schema keys must match camelCase option names

---

## Global config (`appName`)

```ts
await loadConfig({
  schema,
  appName: 'my-api',
});
```

Enables:

```
~/.atk/my-api.yaml
./my-api.yaml
```

Used for per-developer overrides.

---

## Full resolution order

Complete merge order:

1. schema defaults
2. baseConfig
3. `./config/{files}`
4. `./config/{NODE_ENV}`
5. `~/.atk/{files}`
6. `./{files}`
7. `~/.atk/{appName}`
8. `./{appName}`
9. env vars
10. overrides

---

## API

```ts
await loadConfig({
  schema,
  files?,
  baseConfig?,
  overrides?,
  appName?,
  paths?,
  strict?,
  skipValidation?,
  debug?,
})
```

```ts
config.get(path)
config.getProperties()
config.getSources()
config.validate()
config.toString()
config.has(path)
```