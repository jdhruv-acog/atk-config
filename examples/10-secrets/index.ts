import { loadConfig } from '../../src/index.js';

async function fetchFromVault(key: string): Promise<string> {
  console.log(`[Vault] Fetching secret: ${key}`);
  await new Promise(resolve => setTimeout(resolve, 100));

  const secrets: Record<string, string> = {
    'db-password': 'super-secret-password-from-vault',
    'api-key': 'sk-1234567890abcdef',
    'jwt-secret': 'jwt-secret-from-vault'
  };

  return secrets[key] || '';
}

async function main() {
  console.log('=== Async Secrets Example ===\n');

  console.log('Step 1: Fetch secrets from vault/secret manager');
  const dbPassword = await fetchFromVault('db-password');
  const apiKey = await fetchFromVault('api-key');
  const jwtSecret = await fetchFromVault('jwt-secret');

  console.log('\nStep 2: Load config with secrets as defaults');
  const config = await loadConfig({
    schema: {
      database: {
        host: {
          doc: 'Database host',
          format: String,
          default: 'localhost',
          env: 'DB_HOST'
        },
        password: {
          doc: 'Database password',
          format: String,
          default: dbPassword,
          sensitive: true
        }
      },
      api: {
        key: {
          doc: 'External API key',
          format: String,
          default: apiKey,
          sensitive: true
        }
      },
      jwt: {
        secret: {
          doc: 'JWT signing secret',
          format: String,
          default: jwtSecret,
          sensitive: true
        }
      }
    }
  });

  console.log('\nStep 3: Use config (sensitive values masked)');
  console.log('Database:', `${config.get('database.host')}:****`);
  console.log('API Key:', config.get('api.key').substring(0, 8) + '...');
  console.log('JWT Secret:', '****');

  console.log('\n=== Why async matters ===');
  console.log('Secret managers (Vault, AWS Secrets Manager, GCP Secret Manager)');
  console.log('require async operations. loadConfig() is async to support this.');

  console.log('\n=== Config toString() masks sensitive values ===');
  console.log(config.toString());
}

main().catch(console.error);
