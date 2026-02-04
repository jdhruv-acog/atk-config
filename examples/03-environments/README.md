# 03-environments

Demonstrates NODE_ENV-based environment-specific configuration.

## What it demonstrates

- Automatic loading of `{NODE_ENV}.yaml` files
- Environment-specific overrides
- Deep merge with environment configs

## Files loaded

1. `config/app.yaml` - Base configuration
2. `config/{NODE_ENV}.yaml` - Environment-specific overrides
   - `development.yaml` when NODE_ENV=development (default)
   - `production.yaml` when NODE_ENV=production
   - `testing.yaml` when NODE_ENV=testing

## How it works

The loader automatically looks for a config file matching NODE_ENV and deep merges it after the base files.

For example, with NODE_ENV=production:
1. Load `app.yaml`: `database.pool.max = 10`
2. Load `production.yaml`: `database.pool.max = 50`
3. Result: `database.pool.max = 50` (production value wins)

## Run it

```bash
# Development (default)
bun examples/03-environments/index.ts

# Production
NODE_ENV=production bun examples/03-environments/index.ts

# Testing
NODE_ENV=testing bun examples/03-environments/index.ts
```

## Expected output (development)

```
Environment: development
Database Host: localhost
Database Pool: 1-5
Log Level: debug
```

## Expected output (production)

```
Environment: production
Database Host: prod-db.example.com
Database Pool: 10-50
Log Level: warn
```
