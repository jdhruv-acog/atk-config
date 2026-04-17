import { loadConfig } from '../../src/index.js';

const config = await loadConfig({
  schema: {
    appName: {
      doc: 'Application name',
      format: String,
      default: 'My App',
      env: 'APP_NAME'
    },
    api: {
      url: {
        doc: 'External API URL',
        format: 'url',
        default: 'http://localhost:4000',
        env: 'API_URL'
      },
      timeout: {
        doc: 'API timeout (ms)',
        format: 'nat',
        default: 5000,
        env: 'API_TIMEOUT'
      }
    },
    database: {
      host: {
        doc: 'Database host',
        format: String,
        default: 'localhost',
        env: 'DB_HOST'
      },
      port: {
        doc: 'Database port',
        format: 'port',
        default: 5432,
        env: 'DB_PORT'
      }
    }
  },

  files: ['common', 'app'],

  paths: {
    config: './examples/02-with-files/config'
  },

  debug: true
});

console.log('\n=== Multi-File Configuration ===');
console.log('App Name:', config.get('appName'));
console.log('API URL:', config.get('api.url'));
console.log('API Timeout:', config.get('api.timeout'));
console.log('Database:', `${config.get('database.host')}:${config.get('database.port')}`);
