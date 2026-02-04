# 01-basic

Minimal example showing schema-only configuration with no config files.

## What it demonstrates

- Schema definition with defaults
- Environment variable mapping (`env: 'PORT'`)
- CLI argument mapping (`arg: 'port'`)
- Validation

## Run it

```bash
# Use defaults
bun examples/01-basic/index.ts

# Override with environment variable
PORT=8080 bun examples/01-basic/index.ts

# Override with CLI argument
bun examples/01-basic/index.ts --port 9000
```

## Expected output

```
=== Basic Example ===
Port: 3000
Host: localhost
```
