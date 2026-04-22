import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

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
        default: '',
        env: 'DB_PASSWORD',
        sensitive: true
      },
      connectionString: {
        doc: 'Full connection string',
        format: String,
        default: '',
        env: 'DB_CONNECTION'
      }
    },
    api: {
      url: {
        doc: 'API URL',
        format: 'url',
        default: 'http://localhost:3000',
        env: 'API_URL'
      }
    }
  },

  files: ['app'],

  paths: {
    config: './examples/04-variable-substitution/config'
  },

  debug: true
});

log('=== Variable Substitution Example ===');
log('Database Host: %s', config.get('database.host'));
log('API URL: %s', config.get('api.url'));
log('Connection String: %s', config.get('database.connectionString'));

log('Try with environment variables:');
log('DB_HOST=prod.example.com DB_PASSWORD=secret123 bun examples/04-variable-substitution/index.ts');
log('API_BASE=https://api.prod.com bun examples/04-variable-substitution/index.ts');
