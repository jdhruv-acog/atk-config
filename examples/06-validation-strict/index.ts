import { loadConfig } from '../../src/index.js';

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

try {
  config.validate();
  console.log('=== Validation Strict Example ===');
  console.log('Port:', config.get('port'));
  console.log('Host:', config.get('host'));
  console.log('\n✓ Validation passed');
} catch (error) {
  console.error('=== Validation Failed ===');
  console.error('Error:', error.message);
  console.error('\nThe config file contains keys not declared in the schema.');
  console.error('Remove them or add them to the schema.');
  process.exit(1);
}
