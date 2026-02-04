# atk-config

Schema-validated hierarchical configuration with automatic file discovery.

## Why?

**Problem:** Config management is complex:
- Runtime type errors from config files
- Manual file loading is tedious
- Different values per environment
- Secrets mixed with config

**Solution:** Combine convict's schema validation with automatic hierarchical file loading.

## Requirements

- Node.js >= 16.9.0

## Install

```bash
bun install atk-config
```

## Quick Start

```typescript
import { loadConfig } from 'atk-config';

const config = await loadConfig({
  schema: {
    port: {
      doc: 'Server port',
      format: 'port',
      default: 3000,
      env: 'PORT',
      arg: 'port'
    }
  }
});

config.validate();

const port = config.get('port');
```

## Understanding How It Works

### File Discovery (Explicit Behavior)

When you call `loadConfig({ files: ['common', 'app'] })`, here's **exactly** what happens:

**1. File Discovery:**
- `files` are **base names**, not full filenames
- Extensions tried in order: `.json`, `.yaml`, `.yml`, `.json5`
- Files are **optional** - missing files are silently skipped
- First matching extension wins

**2. Search Locations:**

Files are searched in this order:

```
1. config/common.json     (or .yaml, .yml, .json5)
2. config/app.json
3. ~/.atk/common.json
4. ~/.atk/app.json
5. ./common.json          (local overrides, typically gitignored)
6. ./app.json
7. config/{NODE_ENV}.json (e.g., production.json if NODE_ENV=production)
8. ~/.atk/{appName}.json  (if appName option provided)
9. ./{appName}.json       (if appName option provided)
```

**Important:** Environment-specific files (`{NODE_ENV}.json`) are **only** loaded from the `config/` directory, not from global or local paths. This keeps environment configs in the project where they belong.

**3. Merging:**

Each layer is **deep merged** (see important notes below) with previous layers.

**4. Variable Substitution:**

Before parsing, `${VAR}`, `${VAR:-default}`, `${VAR:?error}` are replaced.

**5. Environment Variables & CLI Args:**

Applied via convict's schema `env` and `arg` properties (see schema section).

### Validation Lifecycle (Important)

**Loading and validation are separate:**

```typescript
// Step 1: Load and merge (does NOT validate)
const config = await loadConfig({ schema, files: ['app'] });

// Step 2: Validate explicitly (REQUIRED)
config.validate();

// Step 3: Use
const port = config.get('port');
```

**Why separate?**
- You may want to inspect merged config before validation
- Async loading doesn't block on validation
- You control when validation happens

**Validation Options:**

```typescript
// Default: warns on unknown keys
config.validate();

// Strict: throws on unknown keys
config.validate({ allowed: 'strict' });

// Or set strict: true in loadConfig options
const config = await loadConfig({ schema, strict: true });
config.validate(); // automatically strict
```

## Deep Merge Behavior (Critical to Understand)

### Objects are merged

```yaml
# Layer 1
database:
  host: localhost
  port: 5432

# Layer 2
database:
  host: prod.db

# Result: { host: 'prod.db', port: 5432 }
```

### Arrays are replaced

```yaml
# Layer 1
servers: [a, b, c]

# Layer 2
servers: [d]

# Result: [d]  (NOT [a, b, c, d])
```

### Type changes break things

```yaml
# Layer 1
database:
  pool:
    min: 2
    max: 10

# Layer 2
database:
  pool: 5

# Result: database.pool = 5 (number)
# If schema expects object → validation error
```

**⚠️ Important:** Deep merge happens **before** validation. If a merge produces invalid types, validation will fail with potentially confusing errors.

**Debugging tip:** Use `DEBUG=atk:config` to see which files are loaded.

## Schema Definition

atk-config uses [convict](https://github.com/mozilla/node-convict) schemas:

```typescript
{
  key: {
    doc: 'Description',           // Documentation string
    format: 'port',                // Validator (see formats below)
    default: 3000,                 // Default value (required)
    env: 'PORT',                   // Environment variable name
    arg: 'port',                   // CLI argument (--port 8080)
    sensitive: true                // Mask in logs (optional)
  }
}
```

### Built-in Formats

- `'port'` - 0-65535
- `'nat'` - Natural number (>= 0)
- `'int'` - Integer
- `'url'` - Valid URL
- `'email'` - Valid email
- `'ipaddress'` - IPv4/IPv6
- `String` - Any string
- `Number` - Any number
- `Boolean` - Boolean
- `Array` - Array
- `['a', 'b', 'c']` - Enum (must be one of these values)

### Nested Schemas

```typescript
{
  database: {
    host: {
      format: String,
      default: 'localhost',
      env: 'DB_HOST'
    },
    port: {
      format: 'port',
      default: 5432,
      env: 'DB_PORT'
    }
  }
}
```

## Environment Variables

Environment variables are mapped via the `env` property in your schema:

```typescript
schema: {
  port: {
    format: 'port',
    default: 3000,
    env: 'PORT'        // Maps PORT env var to this key
  }
}
```

```bash
PORT=8080 bun index.ts  # port becomes 8080
```

**Note:** There is no "prefix" feature. Each schema field explicitly maps to an env var name.

## CLI Arguments

CLI arguments are mapped via the `arg` property:

```typescript
schema: {
  port: {
    format: 'port',
    default: 3000,
    arg: 'port'        // Maps --port CLI arg
  }
}
```

```bash
bun index.ts --port 8080
```

## Variable Substitution

In config files, reference environment variables:

```yaml
database:
  host: ${DB_HOST:-localhost}      # Use DB_HOST or default to "localhost"
  password: ${DB_PASSWORD:?required}  # Throw error if DB_PASSWORD not set
  port: ${DB_PORT}                 # Use DB_PORT if set, otherwise literal "${DB_PORT}"
```

**Syntax:**
- `${VAR}` - Replace with value or leave as-is
- `${VAR:-default}` - Replace with value or use default
- `${VAR:?error message}` - Replace with value or throw error

**Substitution happens before parsing**, so you can use it anywhere in YAML/JSON.

**Note:** Variable names are case-sensitive and must be uppercase with underscores (e.g., `DB_HOST`, not `db_host`).

## Reloading Configuration

For long-running applications that need to pick up config changes without restarting:

```typescript
const config = await loadConfig({ schema, files: ['app'] });

// Later, when config files change
await config.reload();
```

**What reload() does:**
1. Re-reads all config files from disk
2. Re-applies environment variables and CLI arguments
3. Updates the config object in-place
4. Validates the new configuration

**Use cases:**
- Long-running servers that need config updates without restart
- Feature flags that can be toggled at runtime
- Development: change config and reload without restarting

See `examples/11-reload` for a complete example.

## Error Messages

Config errors now include file context to help you debug:

```
Failed to parse examples/03-environments/config/production.yaml:
  Unexpected token } in JSON at position 45

Required environment variable DB_PASSWORD is not set in config/app.yaml
```

**Multiple file formats warning:**

If you have both `app.json` and `app.yaml`, atk-config warns you:

```
[atk:config] Warning: Multiple config files found for config/app:
[atk:config]   - config/app.json
[atk:config]   - config/app.yaml
[atk:config] Using: config/app.json
```

## Configuration Options

```typescript
interface LoadConfigOptions {
  schema: Schema;              // Convict schema (required)

  files?: string[];            // Base names to load (default: ['config'])
                               // Tries .json, .yaml, .yml, .json5

  defaults?: Record<string, any>; // Bundled defaults (optional)
                                  // Merged before file loading

  paths?: {
    config?: string;           // Where to find config files (default: './config')
    global?: string;           // Global config dir (default: '~/.atk')
    local?: string;            // Local overrides dir (default: '.')
  };

  appName?: string;            // App-specific global config file
                               // Looks for ~/.atk/{appName}.json

  strict?: boolean;            // If true, validate() fails on unknown keys
                               // (default: false)

  debug?: boolean;             // Enable debug logging (default: false)
                               // Or use DEBUG=atk:config env var
}
```

## File Structure Example

```
project/
├── config/
│   ├── common.yaml          # Shared across environments
│   ├── app.yaml             # App-specific shared
│   ├── development.yaml     # Dev overrides (NODE_ENV=development)
│   ├── production.yaml      # Prod overrides (NODE_ENV=production)
│   └── testing.yaml         # Test overrides (NODE_ENV=testing)
│
├── src/
│   ├── config.ts            # Schema definition
│   └── index.ts             # Application code
│
└── .gitignore               # Add: app.yaml, common.yaml, atk-config.*
```

## Secrets Management

**⚠️ Never commit secrets to config files.**

**Option 1: Environment Variables (Development)**

```yaml
# config/app.yaml
database:
  password: ${DB_PASSWORD:?required}
```

```bash
export DB_PASSWORD="dev_secret"
```

**Option 2: Async Secret Managers (Production)**

Since `loadConfig` is async, you can fetch secrets before calling it:

```typescript
import { loadConfig } from 'atk-config';

// Fetch secrets from Vault/AWS Secrets Manager
const dbPassword = await fetchFromVault('db-password');

const config = await loadConfig({
  schema: {
    database: {
      password: {
        format: String,
        default: dbPassword,  // Inject secret as default
        sensitive: true
      }
    }
  }
});
```

**Option 3: Local Secrets File (Development)**

```yaml
# ./app.yaml (gitignored)
database:
  password: "local_dev_password"
```

Add to `.gitignore`:
```
app.yaml
common.yaml
atk-config.*
```

## Examples

### Basic Usage

```typescript
import { loadConfig } from 'atk-config';

const config = await loadConfig({
  schema: {
    port: {
      format: 'port',
      default: 3000,
      env: 'PORT'
    }
  }
});

config.validate();
console.log(config.get('port'));
```

### Multi-Environment

```typescript
const config = await loadConfig({
  schema: {
    env: {
      format: ['production', 'development', 'testing'],
      default: 'development',
      env: 'NODE_ENV'
    },
    database: {
      host: {
        format: String,
        default: 'localhost',
        env: 'DB_HOST'
      }
    }
  },
  files: ['common', 'app']
});

config.validate();
```

**File loading:**
```
1. config/common.yaml
2. config/app.yaml
3. config/development.yaml (if NODE_ENV=development)
```

### With Bundled Defaults

```typescript
const config = await loadConfig({
  schema: { /* ... */ },
  files: ['app'],

  defaults: {
    'app': {
      server: { port: 3000 },
      database: { host: 'localhost' }
    }
  }
});
```

**Loading order:**
```
1. Schema defaults
2. Bundled defaults (from code)
3. config/app.yaml (from file)
```

## Debugging

Enable debug mode to see file loading:

```bash
DEBUG=atk:config bun index.ts
```

**Output:**
```
[atk:config] Starting configuration load
[atk:config] NODE_ENV: development
[atk:config] Files: common, app
[atk:config] NOTE: Files are optional - missing files are skipped
[atk:config] Loading config/common.yaml
[atk:config] Loading config/app.yaml
[atk:config] Loading config/development.yaml
[atk:config] Not found: ~/.atk/common.json
[atk:config] Configuration loaded and merged
[atk:config] IMPORTANT: Call config.validate() to validate against schema
```

## Common Issues

### "Configuration param not declared in schema"

**Cause:** A config file has a key not in your schema.

**Solutions:**
1. Add the key to your schema
2. Remove it from config files
3. Use non-strict mode (default) to ignore it

### "Must be a [type], got [different type]"

**Cause:** Deep merge changed a value's type.

**Example:**
```yaml
# config/common.yaml
database:
  pool: { min: 2, max: 10 }

# config/production.yaml
database:
  pool: 5
```

After merge: `pool` is `5` (number), but schema expects object.

**Solution:** Don't change types between layers. Keep structure consistent.

### Arrays not merging as expected

**Remember:** Arrays are **replaced**, not merged.

```yaml
# Layer 1: servers: [a, b, c]
# Layer 2: servers: [d]
# Result: [d]
```

## Migration from Old atk-config

**Before:**
```typescript
import { getConfig } from '@aganitha/atk-config';

const config = getConfig({
  configNames: ['common.yaml', 'app.yaml'],
  defaultConfigs: { ... }
});
```

**After:**
```typescript
import { loadConfig } from 'atk-config';

const config = await loadConfig({  // Now async
  schema: { ... },                  // Add schema
  files: ['common', 'app'],         // Simplified names
  defaults: { ... }
});

config.validate();  // Explicit validation
```

**Key changes:**
1. **Async**: `await loadConfig()`
2. **Schema required**: Add convict schema
3. **Explicit validation**: Call `config.validate()`
4. **No env prefix**: Map env vars directly in schema

## TypeScript

Full type safety:

```typescript
const config = await loadConfig({
  schema: {
    port: { format: 'port', default: 3000 }
  }
});

const port: number = config.get('port');  // Type-safe
```

## License

MIT
