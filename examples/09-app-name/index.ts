import { loadConfig } from '../../src/index.js';

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

config.validate();

console.log('\n=== App Name Example ===');
console.log('App Name:', config.get('appName'));
console.log('Server Port:', config.get('server.port'));
console.log('Database Host:', config.get('database.host'));

console.log('\n=== How appName works ===');
console.log('When appName is set to "myapp", the loader looks for:');
console.log('  ~/.atk/myapp.{json,yaml,yml,json5}');
console.log('  ./myapp.{json,yaml,yml,json5}');
console.log('');
console.log('This allows user-specific config stored in home directory.');

console.log('\n=== Create a global config (optional) ===');
console.log('mkdir -p ~/.atk');
console.log('echo "server:\\n  port: 7000" > ~/.atk/myapp.yaml');
console.log('bun examples/09-app-name/index.ts');
