import { loadConfig } from '../../src/index.js';

const config = await loadConfig({
  schema: {
    port: {
      doc: 'HTTP server port',
      format: 'port',
      default: 3000,
      env: 'PORT',
      arg: 'port'
    },
    host: {
      doc: 'Server host',
      format: String,
      default: 'localhost',
      env: 'HOST'
    }
  }
});

config.validate();

console.log('=== Basic Example ===');
console.log('Port:', config.get('port'));
console.log('Host:', config.get('host'));
console.log('\nTry:');
console.log('  PORT=8080 bun examples/01-basic/index.ts');
console.log('  bun examples/01-basic/index.ts --port 9000');
