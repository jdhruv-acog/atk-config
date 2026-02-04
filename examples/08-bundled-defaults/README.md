# 08-bundled-defaults

Demonstrates bundling default configuration values in code instead of config files.

## What it demonstrates

- `defaults` option to ship sensible defaults with your package
- Bundled defaults are merged before loading config files
- Config files can override bundled defaults
- Useful for npm packages and libraries

## Use case

When you distribute an npm package or library, you want to:
1. Ship with sensible defaults (no config file required)
2. Allow users to override via config files
3. Allow users to override via environment variables

This example shows how to bundle defaults in your code so users don't need config files to get started.

## Loading order

```
1. Schema defaults          (port: 3000, rateLimit: false)
2. Bundled defaults.common  (rateLimit: true, cors: true)
3. Bundled defaults.app     (port: 8080, timeout: 10000)
4. config/common.yaml       (if user creates it)
5. config/app.yaml          (if user creates it)
6. Environment variables    (PORT=9000)
```

## How bundled defaults work

```typescript
defaults: {
  'common': {
    features: {
      rateLimit: true,
      cors: true
    }
  },
  'app': {
    server: {
      port: 8080
    }
  }
}
```

The keys ('common', 'app') match the `files: ['common', 'app']` array. Each bundled default is loaded in order before looking for the corresponding config file.

## Run it

```bash
# No config files needed - uses bundled defaults
bun examples/08-bundled-defaults/index.ts
```

## Expected output

```
[atk:config] Loaded bundled default: common
[atk:config] Loaded bundled default: app
[atk:config] Not found: config/common.{json,yaml,yml,json5}
[atk:config] Not found: config/app.{json,yaml,yml,json5}

=== Bundled Defaults Example ===
Server Port: 8080
Features:
  Rate Limit: true
  CORS: true
API:
  Timeout: 10000
  Retries: 5
```

## When to use bundled defaults

- **npm packages**: Ship with working defaults, no setup required
- **CLI tools**: Work out-of-the-box without config files
- **Libraries**: Provide sensible defaults that users can override
- **Monorepos**: Share common defaults across packages

## When not to use bundled defaults

- **Applications**: Usually better to have explicit config files
- **Secrets**: Never bundle secrets, always use env vars or secret managers
