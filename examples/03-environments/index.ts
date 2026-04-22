import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

const config = await loadConfig({
  schema: {
    env: {
      doc: 'Application environment',
      format: ['production', 'development', 'testing'],
      default: 'development',
      env: 'NODE_ENV'
    },
    database: {
      host: {
        doc: 'Database host',
        format: String,
        default: 'localhost',
        env: 'DB_HOST'
      },
      pool: {
        min: {
          doc: 'Minimum pool size',
          format: 'nat',
          default: 2,
          env: 'DB_POOL_MIN'
        },
        max: {
          doc: 'Maximum pool size',
          format: 'nat',
          default: 10,
          env: 'DB_POOL_MAX'
        }
      }
    },
    logging: {
      level: {
        doc: 'Log level',
        format: ['debug', 'info', 'warn', 'error'],
        default: 'info',
        env: 'LOG_LEVEL'
      }
    }
  },

  files: ['app'],

  paths: {
    config: './examples/03-environments/config'
  },

  debug: true
});

log('=== Environment-Based Configuration ===');
log('Environment: %s', config.get('env'));
log('Database Host: %s', config.get('database.host'));
log('Database Pool: %d-%d', config.get('database.pool.min'), config.get('database.pool.max'));
log('Log Level: %s', config.get('logging.level'));

log('Try different environments:');
log('NODE_ENV=production bun examples/03-environments/index.ts');
log('NODE_ENV=testing bun examples/03-environments/index.ts');
