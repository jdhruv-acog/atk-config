# atk-config Examples

Comprehensive examples demonstrating all features of atk-config. Each example is self-contained with its own config files and README.

## Quick Start

```bash
# Clone or install atk-config
bun install @aganitha/atk-config

# Run any example
bun examples/01-basic/index.ts
```

## Examples

### [01-basic](./01-basic/)
**Minimal usage with no config files**

Demonstrates:
- Schema definition with defaults
- Environment variable mapping
- CLI argument mapping
- Validation

Run: `bun examples/01-basic/index.ts`

---

### [02-with-files](./02-with-files/)
**Loading multiple config files**

Demonstrates:
- Multi-file configuration: `files: ['common', 'app']`
- Deep merge behavior
- Custom config paths
- Debug mode

Run: `bun examples/02-with-files/index.ts`

---

### [03-environments](./03-environments/)
**NODE_ENV-based configuration**

Demonstrates:
- Automatic loading of `{NODE_ENV}.yaml`
- Environment-specific overrides (development, production, testing)
- Deep merge with environment configs

Run: `NODE_ENV=production bun examples/03-environments/index.ts`

---

### [04-variable-substitution](./04-variable-substitution/)
**Variable substitution in config files**

Demonstrates:
- `${VAR}` syntax
- `${VAR:-default}` with defaults
- `${VAR:?error}` with required check
- Substitution before parsing

Run: `DB_HOST=prod.example.com bun examples/04-variable-substitution/index.ts`

---

### [05-nested-schema](./05-nested-schema/)
**Complex nested schema structure**

Demonstrates:
- Deeply nested schemas (3+ levels)
- Dot notation access: `config.get('server.http.port')`
- Deep merge with nested objects

Run: `bun examples/05-nested-schema/index.ts`

---

### [06-validation-strict](./06-validation-strict/)
**Strict validation mode**

Demonstrates:
- `strict: true` option
- Catching unknown config keys
- Validation error handling

Run: `bun examples/06-validation-strict/index.ts`

---

### [07-cli-and-env](./07-cli-and-env/)
**Priority order demonstration**

Demonstrates:
- CLI arguments vs environment variables
- Priority: CLI args > env vars > config files > defaults
- Runtime overrides

Run: `PORT=8080 bun examples/07-cli-and-env/index.ts --port 9000`

---

### [08-bundled-defaults](./08-bundled-defaults/)
**Bundling defaults in code**

Demonstrates:
- `defaults` option for npm packages
- Shipping with sensible defaults
- No config files required

Run: `bun examples/08-bundled-defaults/index.ts`

---

### [09-app-name](./09-app-name/)
**User-specific global configuration**

Demonstrates:
- `appName` option
- Loading `~/.atk/{appName}.yaml`
- User preferences across projects
- Useful for CLI tools

Run: `bun examples/09-app-name/index.ts`

---

### [10-secrets](./10-secrets/)
**Async secret manager integration**

Demonstrates:
- Why `loadConfig()` is async
- Fetching secrets before config load
- `sensitive: true` to mask secrets
- Integration pattern for Vault, AWS Secrets Manager, etc.

Run: `bun examples/10-secrets/index.ts`

---

### [11-reload](./11-reload/)
**Reloading configuration at runtime**

Demonstrates:
- `config.reload()` method
- Updating config without restart
- Long-running server pattern
- Dynamic configuration

Run: `bun examples/11-reload/index.ts`

---

## Testing All Examples

```bash
# Run all examples in sequence
for dir in examples/*/; do
  echo "Running $(basename "$dir")..."
  bun "$dir/index.ts"
  echo ""
done
```

## Learning Path

**Beginner:**
1. Start with `01-basic` - understand schema and validation
2. Try `02-with-files` - learn file loading and deep merge
3. Explore `03-environments` - see NODE_ENV in action

**Intermediate:**
4. Check `04-variable-substitution` - use env vars in config files
5. Study `05-nested-schema` - organize complex config
6. Test `07-cli-and-env` - understand priority order

**Advanced:**
7. Review `06-validation-strict` - enforce schema compliance
8. Learn `08-bundled-defaults` - ship packages with defaults
9. Examine `09-app-name` - build CLI tools with user config
10. Master `10-secrets` - integrate secret managers
11. Explore `11-reload` - reload config without restart

## Common Patterns

### Web Application
```typescript
const config = await loadConfig({
  schema: { /* ... */ },
  files: ['common', 'app'],
  strict: true
});
```

See: `02-with-files`, `03-environments`

### CLI Tool
```typescript
const config = await loadConfig({
  schema: { /* ... */ },
  appName: 'mytool',
  defaults: { /* bundled defaults */ }
});
```

See: `08-bundled-defaults`, `09-app-name`

### Production App with Secrets
```typescript
const dbPassword = await fetchFromVault('db-password');

const config = await loadConfig({
  schema: {
    database: {
      password: {
        format: String,
        default: dbPassword,
        sensitive: true
      }
    }
  },
  strict: true
});
```

See: `10-secrets`

## Tips

1. **Always call `config.validate()`** after loading
2. **Use `debug: true`** to see which files are loaded
3. **Use `strict: true`** in production to catch config mistakes
4. **Mark secrets with `sensitive: true`** to mask them in logs
5. **Test with different NODE_ENV values** to verify environment-specific config

## Need Help?

- Read the main [README.md](../README.md) for full documentation
- Each example has its own README with detailed explanations
- Check the inline code comments in each example
