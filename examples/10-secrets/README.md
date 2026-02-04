# 10-secrets

Demonstrates async secret manager integration pattern.

## What it demonstrates

- Why `loadConfig()` is async (to support async secret fetching)
- How to fetch secrets before loading config
- Using `sensitive: true` to mask secrets in logs
- Integration with secret managers (Vault, AWS Secrets Manager, etc.)

## Pattern

```typescript
// 1. Fetch secrets asynchronously
const dbPassword = await fetchFromVault('db-password');
const apiKey = await fetchFromSecretManager('api-key');

// 2. Load config with secrets as defaults
const config = await loadConfig({
  schema: {
    database: {
      password: {
        format: String,
        default: dbPassword,  // Secret from vault
        sensitive: true       // Mask in logs
      }
    }
  }
});
```

## Why async?

Secret managers require async API calls:
- HashiCorp Vault: HTTP API
- AWS Secrets Manager: AWS SDK
- GCP Secret Manager: GCP SDK
- Azure Key Vault: Azure SDK

By making `loadConfig()` async, you can fetch secrets first, then inject them as defaults.

## Sensitive values

Mark secrets with `sensitive: true`:

```typescript
password: {
  format: String,
  default: dbPassword,
  sensitive: true  // This masks the value in config.toString()
}
```

When you call `config.toString()`, sensitive values are replaced with `"[Sensitive]"`.

## Run it

```bash
bun examples/10-secrets/index.ts
```

## Expected output

```
=== Async Secrets Example ===

Step 1: Fetch secrets from vault/secret manager
[Vault] Fetching secret: db-password
[Vault] Fetching secret: api-key
[Vault] Fetching secret: jwt-secret

Step 2: Load config with secrets as defaults

Step 3: Use config (sensitive values masked)
Database: localhost:****
API Key: sk-12345...
JWT Secret: ****

=== Config toString() masks sensitive values ===
{
  "database": {
    "host": "localhost",
    "password": "[Sensitive]"
  },
  "api": {
    "key": "[Sensitive]"
  },
  "jwt": {
    "secret": "[Sensitive]"
  }
}
```

## Real-world integration

### HashiCorp Vault

```typescript
import { VaultClient } from 'vault-api';

const vault = new VaultClient({ endpoint: 'https://vault.example.com' });
const dbPassword = await vault.read('secret/data/db-password');

const config = await loadConfig({
  schema: {
    database: {
      password: {
        format: String,
        default: dbPassword.data.password,
        sensitive: true
      }
    }
  }
});
```

### AWS Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'prod/db/password' })
);
const dbPassword = response.SecretString;

const config = await loadConfig({
  schema: {
    database: {
      password: {
        format: String,
        default: dbPassword,
        sensitive: true
      }
    }
  }
});
```

## Security best practices

1. **Never commit secrets** to config files or code
2. **Use sensitive: true** for all secrets in schema
3. **Fetch secrets at startup** before loading config
4. **Rotate secrets regularly** using your secret manager
5. **Use IAM roles** instead of hardcoded credentials where possible
