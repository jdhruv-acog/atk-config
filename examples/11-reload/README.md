# 11-reload

Demonstrates reloading configuration at runtime without restarting the application.

## What it demonstrates

- `config.reload()` method to reload configuration
- Useful for long-running servers
- Dynamic configuration updates
- No restart required

## How it works

When you call `await config.reload()`, atk-config:
1. Re-reads all config files from disk
2. Re-applies all merging logic (defaults → files → env vars)
3. Updates the existing config object in-place

The same config instance is updated, so all references remain valid.

## Run it

```bash
bun examples/11-reload/index.ts
```

## Expected output

```
=== Reload Example ===

Initial configuration:
  Refresh Interval: 120
  Cache Enabled: true

--- Simulating config file change ---
Writing new values to config/app.yaml...

Reloading configuration...

After reload:
  Refresh Interval: 30
  Cache Enabled: false
```

## Use Cases

**Long-running servers:**
```typescript
const config = await loadConfig({ ... });

// Reload every 5 minutes
setInterval(async () => {
  await config.reload();
  console.log('Config reloaded');
}, 5 * 60 * 1000);
```

**Feature flags:**
```typescript
// config/features.yaml
features:
  newUI: false

// In your app
if (config.get('features.newUI')) {
  // Show new UI
}

// Admin updates features.yaml, then:
await config.reload();
// New UI setting is now active
```

**Development workflow:**
```typescript
// Start server
const server = Bun.serve({
  port: config.get('server.port')
});

// During development, change config files
// Then reload without restarting server
await config.reload();
```

## Important Notes

1. **Env vars and CLI args are re-evaluated** - If you change PORT env var, reload will pick it up
2. **Schema is not reloaded** - The schema defined at `loadConfig()` time is used
3. **Validation is automatic** - Reload validates the new config
4. **Atomic update** - If reload fails, old config remains intact

## Watch Mode Pattern

For automatic reloading when files change:

```typescript
import { watch } from 'node:fs';

const config = await loadConfig({ ... });

watch('./config', async (event, filename) => {
  console.log(`Config file ${filename} changed, reloading...`);
  try {
    await config.reload();
    console.log('Config reloaded successfully');
  } catch (error) {
    console.error('Failed to reload config:', error);
  }
});
```
