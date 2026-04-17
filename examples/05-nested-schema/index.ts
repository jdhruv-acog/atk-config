import { loadConfig } from '../../src/index.js';

const config = await loadConfig({
  schema: {
    app: {
      name: {
        doc: 'Application name',
        format: String,
        default: 'My App',
        env: 'APP_NAME'
      },
      version: {
        doc: 'Application version',
        format: String,
        default: '1.0.0',
        env: 'APP_VERSION'
      }
    },
    server: {
      http: {
        port: {
          doc: 'HTTP port',
          format: 'port',
          default: 3000,
          env: 'HTTP_PORT'
        },
        host: {
          doc: 'HTTP host',
          format: String,
          default: '0.0.0.0',
          env: 'HTTP_HOST'
        }
      },
      https: {
        enabled: {
          doc: 'Enable HTTPS',
          format: Boolean,
          default: false,
          env: 'HTTPS_ENABLED'
        },
        port: {
          doc: 'HTTPS port',
          format: 'port',
          default: 3443,
          env: 'HTTPS_PORT'
        }
      }
    },
    database: {
      primary: {
        host: {
          doc: 'Primary database host',
          format: String,
          default: 'localhost',
          env: 'PRIMARY_DB_HOST'
        },
        port: {
          doc: 'Primary database port',
          format: 'port',
          default: 5432,
          env: 'PRIMARY_DB_PORT'
        }
      },
      replica: {
        host: {
          doc: 'Replica database host',
          format: String,
          default: 'localhost',
          env: 'REPLICA_DB_HOST'
        },
        port: {
          doc: 'Replica database port',
          format: 'port',
          default: 5433,
          env: 'REPLICA_DB_PORT'
        }
      }
    }
  },

  files: ['app'],

  paths: {
    config: './examples/05-nested-schema/config'
  }
});

console.log('=== Nested Schema Example ===');
console.log('\nApp:');
console.log('  Name:', config.get('app.name'));
console.log('  Version:', config.get('app.version'));

console.log('\nServer:');
console.log('  HTTP:', `${config.get('server.http.host')}:${config.get('server.http.port')}`);
console.log('  HTTPS Enabled:', config.get('server.https.enabled'));
console.log('  HTTPS:', `${config.get('server.http.host')}:${config.get('server.https.port')}`);

console.log('\nDatabase:');
console.log('  Primary:', `${config.get('database.primary.host')}:${config.get('database.primary.port')}`);
console.log('  Replica:', `${config.get('database.replica.host')}:${config.get('database.replica.port')}`);
