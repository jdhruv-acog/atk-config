# 02-with-files

Demonstrates loading configuration from multiple files with deep merge.

## What it demonstrates

- Loading multiple config files: `files: ['common', 'app']`
- Deep merge behavior (objects merge, later layers override)
- Custom config path: `paths.config`
- Debug mode to see file loading

## Files loaded

1. `config/common.yaml` - Shared configuration
2. `config/app.yaml` - App-specific configuration

## Deep merge example

`common.yaml` sets:
```yaml
api:
  url: https://api.example.com
  timeout: 10000
```

`app.yaml` sets:
```yaml
database:
  host: db.example.com
  port: 5433
```

Result: Both are merged together. If `app.yaml` had set `api.url`, it would override the value from `common.yaml`.

## Run it

```bash
bun examples/02-with-files/index.ts
```

## Expected output

```
[atk:config] Starting configuration load
[atk:config] Loading ./examples/02-with-files/config/common.yaml
[atk:config] Loading ./examples/02-with-files/config/app.yaml
...
=== Multi-File Configuration ===
App Name: Multi-File Demo
API URL: https://api.example.com
API Timeout: 10000
Database: db.example.com:5433
```
