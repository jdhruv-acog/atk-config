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

log('=== CLI Arguments & Environment Variables ===');
log('Server: %s:%d', config.get('server.host'), config.get('server.port'));
log('Debug: %s', config.get('debug'));

log('Configuration Priority (highest to lowest):');
log('1. CLI arguments (--port 9000)');
log('2. Environment variables (PORT=8080)');
log('3. Config files (config/app.yaml)');
log('4. Schema defaults');

log('Try these examples:');
log('PORT=8080 bun examples/07-cli-and-env/index.ts');
log('bun examples/07-cli-and-env/index.ts --port 9000');
log('PORT=8080 bun examples/07-cli-and-env/index.ts --port 9000  # CLI wins');
log('bun examples/07-cli-and-env/index.ts --debug');
