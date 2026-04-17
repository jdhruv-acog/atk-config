import { loadConfig } from '../../src/index.js';

const config = await loadConfig({
  schema: {
    server: {
      port: {
        doc: 'Server port',
        format: 'port',
        default: 3000,
        env: 'PORT',
        arg: 'port'
      },
      host: {
        doc: 'Server host',
        format: String,
        default: 'localhost',
        env: 'HOST',
        arg: 'host'
      }
    },
    debug: {
      doc: 'Enable debug mode',
      format: Boolean,
      default: false,
      env: 'DEBUG',
      arg: 'debug'
    }
  },

  files: ['app'],

  paths: {
    config: './examples/07-cli-and-env/config'
  }
});

console.log('=== CLI Arguments & Environment Variables ===');
console.log('Server:', `${config.get('server.host')}:${config.get('server.port')}`);
console.log('Debug:', config.get('debug'));

console.log('\n=== Configuration Priority (highest to lowest) ===');
console.log('1. CLI arguments (--port 9000)');
console.log('2. Environment variables (PORT=8080)');
console.log('3. Config files (config/app.yaml)');
console.log('4. Schema defaults');

console.log('\n=== Try these examples ===');
console.log('PORT=8080 bun examples/07-cli-and-env/index.ts');
console.log('bun examples/07-cli-and-env/index.ts --port 9000');
console.log('PORT=8080 bun examples/07-cli-and-env/index.ts --port 9000  # CLI wins');
console.log('bun examples/07-cli-and-env/index.ts --debug');
