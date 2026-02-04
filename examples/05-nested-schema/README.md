# 05-nested-schema

Demonstrates complex nested schema structure with multiple levels.

## What it demonstrates

- Deeply nested schema (3+ levels)
- Accessing nested values with dot notation: `config.get('server.http.port')`
- Deep merge behavior with nested objects
- Organizing related configuration together

## Schema structure

```
app
├── name
└── version
server
├── http
│   ├── port
│   └── host
└── https
    ├── enabled
    └── port
database
├── primary
│   ├── host
│   └── port
└── replica
    ├── host
    └── port
```

## Deep merge with nested objects

When merging nested configs, only the specific keys that are set get overridden:

```yaml
# Base layer
server:
  http:
    port: 3000
    host: 0.0.0.0

# Override layer
server:
  http:
    port: 8080

# Result: { http: { port: 8080, host: '0.0.0.0' } }
```

The `host` value is preserved because only `port` was overridden.

## Run it

```bash
bun examples/05-nested-schema/index.ts
```

## Expected output

```
=== Nested Schema Example ===

App:
  Name: Nested Schema Demo
  Version: 2.1.0

Server:
  HTTP: localhost:8080
  HTTPS Enabled: true
  HTTPS: localhost:8443

Database:
  Primary: db-primary.example.com:5432
  Replica: db-replica.example.com:5432
```
