# 07-cli-and-env

Demonstrates CLI arguments and environment variables with priority ordering.

## What it demonstrates

- `env` property maps environment variables
- `arg` property maps CLI arguments
- Priority: CLI args > env vars > config files > schema defaults
- How to override config at runtime

## Priority order (highest wins)

1. **CLI arguments** - `--port 9000`
2. **Environment variables** - `PORT=8080`
3. **Config files** - `config/app.yaml: port: 5000`
4. **Schema defaults** - `default: 3000`

## Run it

```bash
# Use config file value (5000)
bun examples/07-cli-and-env/index.ts

# Use env var (8080)
PORT=8080 bun examples/07-cli-and-env/index.ts

# Use CLI arg (9000)
bun examples/07-cli-and-env/index.ts --port 9000

# CLI arg wins over env var
PORT=8080 bun examples/07-cli-and-env/index.ts --port 9000

# Multiple args
bun examples/07-cli-and-env/index.ts --port 9000 --host 127.0.0.1 --debug
```

## Expected outputs

**Default (config file):**
```
Server: 0.0.0.0:5000
Debug: false
```

**With PORT=8080:**
```
Server: 0.0.0.0:8080
Debug: false
```

**With --port 9000:**
```
Server: 0.0.0.0:9000
Debug: false
```

**With PORT=8080 --port 9000:**
```
Server: 0.0.0.0:9000  (CLI wins)
Debug: false
```

## Use cases

- **CLI args**: One-off overrides for testing, debugging
- **Env vars**: Container orchestration (Docker, Kubernetes), CI/CD
- **Config files**: Persistent settings per environment
- **Schema defaults**: Fallback values for development
