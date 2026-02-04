# 09-app-name

Demonstrates using `appName` to load user-specific global configuration.

## What it demonstrates

- `appName` option for loading ~/.atk/{appName}.yaml
- User-specific configuration in home directory
- Useful for CLI tools and multi-user systems

## How it works

When you set `appName: 'myapp'`, the loader searches for:

```
1. config/app.yaml (project config)
2. ~/.atk/myapp.yaml (global user config)
3. ./myapp.yaml (local override)
```

This allows:
- **Project config**: Shipped with the project
- **Global user config**: User's personal preferences across all projects
- **Local override**: Per-project user overrides (gitignored)

## Use cases

**CLI tools:**
```
User installs: npm install -g myapp
User configures: echo "theme: dark" > ~/.atk/myapp.yaml
Every project now uses dark theme by default
```

**Multi-user systems:**
```
System admin: Sets defaults in /etc/myapp/app.yaml
User alice: Overrides in ~/.atk/myapp.yaml
User bob: Overrides in ~/.atk/myapp.yaml
Each user gets their own config
```

## Run it

```bash
# Without global config (uses project config only)
bun examples/09-app-name/index.ts

# Create global config
mkdir -p ~/.atk
echo "server:
  port: 7000
database:
  host: global-db.example.com" > ~/.atk/myapp.yaml

# Run again (global config merges with project config)
bun examples/09-app-name/index.ts

# Clean up
rm ~/.atk/myapp.yaml
```

## Expected output (without global config)

```
App Name: App Name Example
Server Port: 4000
Database Host: db.example.com
```

## Expected output (with ~/.atk/myapp.yaml)

```
App Name: App Name Example
Server Port: 7000
Database Host: global-db.example.com
```

## Best practices

- Use `appName` for CLI tools and utilities
- Don't use `appName` for web apps (use environment-specific config instead)
- Document to users where their global config should go
- Keep global config minimal (only user preferences, not secrets)
