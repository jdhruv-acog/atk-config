import { loadConfig } from '../../src/index.js';

const config = await loadConfig({
  schema: {
    server: {
      port: {
        doc: 'Server port',
        format: 'port',
        default: 3000,
        env: 'PORT'
      }
    },
    features: {
      rateLimit: {
        doc: 'Enable rate limiting',
        format: Boolean,
        default: false,
        env: 'RATE_LIMIT'
      },
      cors: {
        doc: 'Enable CORS',
        format: Boolean,
        default: false,
        env: 'CORS'
      }
    },
    api: {
      timeout: {
        doc: 'API timeout (ms)',
        format: 'nat',
        default: 5000,
        env: 'API_TIMEOUT'
      },
      retries: {
        doc: 'Number of retries',
        format: 'nat',
        default: 3,
        env: 'API_RETRIES'
      }
    }
  },

  files: ['common', 'app'],

  defaults: {
    'common': {
      features: {
        rateLimit: true,
        cors: true
      }
    },
    'app': {
      server: {
        port: 8080
      },
      api: {
        timeout: 10000,
        retries: 5
      }
    }
  },

  paths: {
    config: './examples/08-bundled-defaults/config'
  },

  debug: true
});

config.validate();

console.log('\n=== Bundled Defaults Example ===');
console.log('Server Port:', config.get('server.port'));
console.log('Features:');
console.log('  Rate Limit:', config.get('features.rateLimit'));
console.log('  CORS:', config.get('features.cors'));
console.log('API:');
console.log('  Timeout:', config.get('api.timeout'));
console.log('  Retries:', config.get('api.retries'));

console.log('\n=== Loading Order ===');
console.log('1. Schema defaults (lowest priority)');
console.log('2. Bundled defaults.common (from code)');
console.log('3. Bundled defaults.app (from code)');
console.log('4. config/common.yaml (if exists)');
console.log('5. config/app.yaml (if exists)');
console.log('6. Environment variables (highest priority)');
