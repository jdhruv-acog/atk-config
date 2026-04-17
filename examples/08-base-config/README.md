# 08-base-config

Demonstrates the `baseConfig` option — a programmatic base layer merged before any config files.

## What it demonstrates

- `baseConfig` option for code-driven default values
- `baseConfig` is lower priority than config files (files can override it)
- Useful when defaults come from code at runtime, not from static files

## Priority order

```
schema default < baseConfig < config file < env var < overrides
```

The schema's `default` field is the absolute fallback. `baseConfig` sits just above it.
Config files still win over `baseConfig`, so users can always override.

## When to use `baseConfig`

- Defaults that are **computed at runtime** (e.g., derived from another config value)
- Feature flags set from code based on environment detection
- Defaults for a library or npm package you distribute

## When to use schema `default` instead

For static defaults that are always the same — put them directly in the schema's `default` field.
`baseConfig` is for values that aren't known until the code runs.

## Run it

```bash
bun examples/08-base-config/index.ts
```
