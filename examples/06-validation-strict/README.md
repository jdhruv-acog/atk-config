# 06-validation-strict

Demonstrates strict validation mode that throws errors on unknown config keys.

## What it demonstrates

- `strict: true` option
- Validation errors when config has undeclared keys
- Difference between strict and non-strict mode

## Validation modes

**Non-strict (default):**
- Warns about unknown keys in console
- Does not throw errors
- Allows extra keys in config files

**Strict mode:**
- Throws errors on unknown keys
- Forces you to declare all config keys in schema
- Catches typos and unused config

## Run it

```bash
# This will fail because app.yaml has an extraKey
bun examples/06-validation-strict/index.ts

# To make it pass, rename app-valid.yaml to app.yaml
cd examples/06-validation-strict/config
mv app.yaml app-invalid.yaml
mv app-valid.yaml app.yaml
cd ../../..
bun examples/06-validation-strict/index.ts
```

## Expected output (with invalid config)

```
=== Validation Failed ===
Error: configuration param 'extraKey' not declared in the schema
```

## Expected output (with valid config)

```
=== Validation Strict Example ===
Port: 8080
Host: 0.0.0.0

✓ Validation passed
```

## When to use strict mode

- Production environments where you want to catch config mistakes early
- When you want to enforce that all config is explicitly declared
- When you want to prevent typos in config files

## When not to use strict mode

- Development where you might add config keys before adding them to schema
- When integrating with third-party config files you don't control
