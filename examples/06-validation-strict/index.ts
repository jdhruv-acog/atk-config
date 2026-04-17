import { loadConfig } from '../../src/index.js';

// config/app.yaml contains unknown keys. With strict: true, loadConfig
// throws during auto-validation — no separate validate() call needed.

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

  console.log('=== Validation Strict Example ===');
  console.log('Port:', config.get('port'));
  console.log('Host:', config.get('host'));
  console.log('\n✓ Validation passed (try config/app.yaml to see it fail)');
  console.log('   Run with app-valid.yaml to see it pass:');
  console.log('   Copy config/app-valid.yaml to config/app.yaml and re-run');
} catch (error: any) {
  console.error('=== Validation Failed (expected) ===');
  console.error('Error:', error.message);
  console.error('\nconfig/app.yaml has keys not declared in the schema.');
  console.error('Fix: either add those keys to the schema, or remove them from the file.');
  process.exit(1);
}
