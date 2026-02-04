import { loadConfig } from '../../src/index.js';

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

config.validate();

console.log('\n=== Variable Substitution Example ===');
console.log('Database Host:', config.get('database.host'));
console.log('API URL:', config.get('api.url'));
console.log('Connection String:', config.get('database.connectionString'));

console.log('\n=== Try with environment variables ===');
console.log('DB_HOST=prod.example.com DB_PASSWORD=secret123 bun examples/04-variable-substitution/index.ts');
console.log('API_BASE=https://api.prod.com bun examples/04-variable-substitution/index.ts');
