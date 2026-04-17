# Example 11: Commander Integration

Demonstrates the clean pattern for using atk-config alongside a Commander CLI.

## The pattern

**Commander owns:** CLI UX — help text, version, subcommands, option parsing.
**atk-config owns:** Everything else — file loading, env vars, validation, merging.

The handoff is one line: pass `program.opts()` (and your subcommand's opts) as `overrides`.

```typescript
program.command('serve')
  .option('--port <n>', 'Port')
  .action(async (commandOpts) => {
    const config = await loadConfig({
      schema,
      overrides: {
        ...program.opts(),   // global options
        ...commandOpts,      // this command's options
      },
    });
  });
```

## Naming convention

For Commander opts to flow into overrides cleanly, **CLI-overridable schema keys should be at the top level with camelCase names matching the Commander option name**:

```
--port       → Commander opts.port      → schema key port      ✓
--log-level  → Commander opts.logLevel  → schema key logLevel  ✓
```

Deeply nested schema keys (`database.host`) are not CLI-overridable — they live in config files or env vars. Use env vars for those (`DB_HOST`).

## Priority order

```
schema default < config files < env vars < Commander overrides
```

CLI flags win. If the user doesn't pass a flag, that key is `undefined` in `program.opts()` and is silently ignored — the file/env value is used instead.

## Running

```bash
# Requires commander: bun add commander
bun examples/11-commander/index.ts serve
bun examples/11-commander/index.ts serve --port 9000
bun examples/11-commander/index.ts serve --port 9000 --log-level debug
bun examples/11-commander/index.ts status
bun examples/11-commander/index.ts --help

# Env var vs CLI — CLI wins
PORT=8080 bun examples/11-commander/index.ts serve            # port = 8080
PORT=8080 bun examples/11-commander/index.ts serve --port 9000  # port = 9000
```
