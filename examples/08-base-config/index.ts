import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

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

log('=== Base Config Example ===');
log('Server Port: %d', config.get('server.port'));
log('Features:');
log('  Rate Limit: %s', config.get('features.rateLimit'));
log('  CORS: %s', config.get('features.cors'));
log('API:');
log('  Timeout: %d', config.get('api.timeout'));
log('  Retries: %d', config.get('api.retries'));
log('Sources: %s', config.getSources().join(', ') || 'none');
