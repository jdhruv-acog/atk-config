import { loadConfig } from '../../src/index.js';

/**
 * The `baseConfig` option sets a programmatic base layer that sits above
 * schema defaults but below config files.
 *
 * Priority: schema default < baseConfig < config file < env var < overrides
 *
 * Use it when your defaults come from code at runtime — computed values,
 * feature flags, or anything not known at schema-definition time.
 */

const config = await loadConfig({
  schema: {
    server: {
      port: {
        doc: 'Server port',
        format: 'port',
        default: 3000,
        env: 'PORT',
      },
    },
    features: {
      rateLimit: {
        doc: 'Enable rate limiting',
        format: Boolean,
        default: false,
        env: 'RATE_LIMIT',
      },
      cors: {
        doc: 'Enable CORS',
        format: Boolean,
        default: false,
        env: 'CORS',
      },
    },
    api: {
      timeout: {
        doc: 'API timeout (ms)',
        format: 'nat',
        default: 5000,
        env: 'API_TIMEOUT',
      },
      retries: {
        doc: 'Number of retries',
        format: 'nat',
        default: 3,
        env: 'API_RETRIES',
      },
    },
  },

  // baseConfig is merged as the base layer before any files.
  // Config files can still override these values.
  baseConfig: {
    server: { port: 8080 },
    features: { rateLimit: true, cors: true },
    api: { timeout: 10000, retries: 5 },
  },

  paths: {
    config: './examples/08-base-config/config',
  },

  debug: true,
});

console.log('\n=== Base Config Example ===');
console.log('Server Port:', config.get('server.port'));
console.log('Features:');
console.log('  Rate Limit:', config.get('features.rateLimit'));
console.log('  CORS:', config.get('features.cors'));
console.log('API:');
console.log('  Timeout:', config.get('api.timeout'));
console.log('  Retries:', config.get('api.retries'));
console.log('\nSources:', config.getSources().join(', ') || 'none');
