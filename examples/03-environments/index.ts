import { loadConfig } from '../../src/index.js';

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

config.validate();

console.log('\n=== Environment-Based Configuration ===');
console.log('Environment:', config.get('env'));
console.log('Database Host:', config.get('database.host'));
console.log('Database Pool:', `${config.get('database.pool.min')}-${config.get('database.pool.max')}`);
console.log('Log Level:', config.get('logging.level'));

console.log('\n=== Try different environments ===');
console.log('NODE_ENV=production bun examples/03-environments/index.ts');
console.log('NODE_ENV=testing bun examples/03-environments/index.ts');
