import { loadConfig } from '../../src/index.js';
import debug from '@aganitha/atk-debug';

const log = debug('atk:config:example');

/**
 * The simplest usage: define a schema, call loadConfig.
 *
 * Values are resolved from lowest to highest priority:
 *   schema default → config file → env var → overrides
 *
 * Try it:
 *   bun examples/01-basic/index.ts
 *   PORT=8080 bun examples/01-basic/index.ts
 *   NODE_ENV=production bun examples/01-basic/index.ts
 */

const config = await loadConfig({
  schema: {
    port: {
      doc: 'HTTP server port',
      format: 'port',
      default: 3000,
      env: 'PORT',
    },
    host: {
      doc: 'Server host',
      format: String,
      default: 'localhost',
      env: 'HOST',
    },
    logLevel: {
      doc: 'Log verbosity',
      format: ['debug', 'info', 'warn', 'error'] as const,
      default: 'info' as const,
      env: 'LOG_LEVEL',
    },
  },
  paths: {
    config: './examples/01-basic/config',
  },
});

// Return types are fully inferred — no casting needed
const port: number = config.get('port');
const host: string = config.get('host');
const logLevel: 'debug' | 'info' | 'warn' | 'error' = config.get('logLevel');

log('=== Basic Example ===');
log(`Server  : http://${host}:${port}`);
log(`LogLevel: ${logLevel}`);
log(`Sources : ${config.getSources().join(', ') || 'none (all defaults)'}`);
