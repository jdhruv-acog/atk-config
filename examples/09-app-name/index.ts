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
    server: {
      port: {
        doc: 'Server port',
        format: 'port',
        default: 3000,
        env: 'PORT'
      }
    },
    database: {
      host: {
        doc: 'Database host',
        format: String,
        default: 'localhost',
        env: 'DB_HOST'
      }
    }
  },

  files: ['app'],

  appName: 'myapp',

  paths: {
    config: './examples/09-app-name/config'
  },

  debug: true
});

log('=== App Name Example ===');
log('App Name: %s', config.get('appName'));
log('Server Port: %d', config.get('server.port'));
log('Database Host: %s', config.get('database.host'));

log('How appName works:');
log('When appName is set to "myapp", the loader also loads:');
log('  ~/.atk/myapp.{json,yaml,yml,json5}');
log('This allows personal developer overrides stored outside the project.');

log('Create a global config (optional):');
log('mkdir -p ~/.atk');
log('echo "server:\\n  port: 7000" > ~/.atk/myapp.yaml');
log('bun examples/09-app-name/index.ts');
