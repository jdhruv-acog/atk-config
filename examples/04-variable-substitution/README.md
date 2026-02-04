# 04-variable-substitution

Demonstrates variable substitution in config files using `${VAR}` syntax.

## What it demonstrates

- `${VAR}` - Replace with environment variable value
- `${VAR:-default}` - Replace with value or use default
- `${VAR:?error}` - Replace with value or throw error
- Substitution happens before parsing

## Config file

```yaml
database:
  host: ${DB_HOST:-localhost}
  password: ${DB_PASSWORD}
  connectionString: postgresql://${DB_HOST:-localhost}:5432/mydb

api:
  url: ${API_BASE:-http://localhost:3000}/v1
```

## How it works

1. Before parsing the YAML, atk-config replaces `${VAR}` patterns with environment variable values
2. If `${VAR:-default}` is used and VAR is not set, the default is used
3. If `${VAR}` is used and VAR is not set, it's left as-is (literal string)
4. If `${VAR:?message}` is used and VAR is not set, an error is thrown

## Run it

```bash
# Without env vars (uses defaults)
bun examples/04-variable-substitution/index.ts

# With env vars
DB_HOST=prod.example.com DB_PASSWORD=secret123 bun examples/04-variable-substitution/index.ts

# With custom API base
API_BASE=https://api.prod.com bun examples/04-variable-substitution/index.ts
```

## Expected output (no env vars)

```
Database Host: localhost
API URL: http://localhost:3000/v1
Connection String: postgresql://localhost:5432/mydb
```

## Expected output (with DB_HOST=prod.example.com)

```
Database Host: prod.example.com
API URL: http://localhost:3000/v1
Connection String: postgresql://prod.example.com:5432/mydb
```
