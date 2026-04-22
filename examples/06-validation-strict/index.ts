import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

try {
  const config = await loadConfig({
    schema: {
      port: {
        doc: 'Server port',
        format: 'port',
        default: 3000,
        env: 'PORT'
      },
      host: {
        doc: 'Server host',
        format: String,
        default: 'localhost',
        env: 'HOST'
      }
    },

    files: ['app'],

    paths: {
      config: './examples/06-validation-strict/config'
    },

    strict: true
  });

  log('=== Validation Strict Example ===');
  log('Port: %d', config.get('port'));
  log('Host: %s', config.get('host'));
  log('✓ Validation passed (try config/app.yaml to see it fail)');
  log('   Run with app-valid.yaml to see it pass:');
  log('   Copy config/app-valid.yaml to config/app.yaml and re-run');
} catch (error: any) {
  log('=== Validation Failed (expected) ===');
  log('Error: %s', error.message);
  log('config/app.yaml has keys not declared in the schema.');
  log('Fix: either add those keys to the schema, or remove them from the file.');
  process.exit(1);
}
