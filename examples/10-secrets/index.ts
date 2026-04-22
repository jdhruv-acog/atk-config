import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

async function fetchFromVault(key: string): Promise<string> {
  log('[Vault] Fetching secret: %s', key);
  await new Promise(resolve => setTimeout(resolve, 100));

  const secrets: Record<string, string> = {
    'db-password': 'super-secret-password-from-vault',
    'api-key': 'sk-1234567890abcdef',
    'jwt-secret': 'jwt-secret-from-vault'
  };

  return secrets[key] || '';
}

async function main() {
  log('=== Async Secrets Example ===');

  log('Step 1: Fetch secrets from vault/secret manager');
  const dbPassword = await fetchFromVault('db-password');
  const apiKey = await fetchFromVault('api-key');
  const jwtSecret = await fetchFromVault('jwt-secret');

  log('Step 2: Load config with secrets as defaults');
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

  log('Step 3: Use config (sensitive values masked)');
  log('Database: %s:****', config.get('database.host'));
  log('API Key: %s...', config.get('api.key').substring(0, 8));
  log('JWT Secret: ****');

  log('Why async matters:');
  log('Secret managers (Vault, AWS Secrets Manager, GCP Secret Manager)');
  log('require async operations. loadConfig() is async to support this.');

  log('Config toString() masks sensitive values:');
  log(config.toString());
}

main().catch((err) => log('Error: %s', err.message));
