import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

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

log('=== Multi-File Configuration ===');
log('App Name: %s', config.get('appName'));
log('API URL: %s', config.get('api.url'));
log('API Timeout: %d', config.get('api.timeout'));
log('Database: %s:%d', config.get('database.host'), config.get('database.port'));
