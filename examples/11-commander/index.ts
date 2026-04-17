import { Command } from 'commander';
import { loadConfig } from '../../src/index.js';

// ─── Schema ───────────────────────────────────────────────────────────────────
// CLI-overridable keys live at the top level with camelCase names that match
// Commander option names exactly. Deep nesting is for file/env-only config.

const schema = {
  port: {
    doc: 'Port to listen on',
    format: 'port',
    default: 3000,
    env: 'PORT',
  },
  host: {
    doc: 'Host to bind to',
    format: String,
    default: 'localhost',
    env: 'HOST',
  },
  logLevel: {
    doc: 'Log verbosity',
    format: ['debug', 'info', 'warn', 'error'] as const,
    default: 'info',
    env: 'LOG_LEVEL',
  },
};

// ─── Commander setup ──────────────────────────────────────────────────────────
// Commander owns the CLI UX: help text, version, subcommands.
// atk-config owns everything else: files, env vars, validation, merging.

const program = new Command()
  .name('my-server')
  .description('Example server with atk-config + Commander')
  .version('1.0.0');

// Global options — available to all subcommands via program.opts()
program.option('--log-level <level>', 'Log level (debug|info|warn|error)');

// ─── serve command ────────────────────────────────────────────────────────────
program
  .command('serve')
  .description('Start the HTTP server')
  .option('--port <n>', 'Port to listen on')
  .option('--host <host>', 'Host to bind to')
  .action(async (commandOpts) => {
    // Load config with Commander opts as highest-priority overrides.
    // { ...program.opts() } captures global options (--log-level)
    // { ...commandOpts }    captures this command's options (--port, --host)
    // undefined values are automatically ignored — only set flags win.
    const config = await loadConfig({
      schema,
      paths: { config: './examples/11-commander/config' },
      overrides: {
        ...program.opts(),
        ...commandOpts,
      },
    });

    console.log('\n=== serve ===');
    console.log(`Listening on http://${config.get('host')}:${config.get('port')}`);
    console.log(`Log level : ${config.get('logLevel')}`);
    console.log(`Sources   : ${config.getSources().join(', ') || 'none (all defaults)'}`);
  });

// ─── status command ───────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show resolved configuration')
  .action(async () => {
    const config = await loadConfig({
      schema,
      paths: { config: './examples/11-commander/config' },
      overrides: program.opts(), // global opts only — no subcommand-specific overrides
    });

    console.log('\n=== status ===');
    console.log('Resolved config:');
    console.log(JSON.stringify(config.getProperties(), null, 2));
    console.log('\nSources:', config.getSources().join(', ') || 'none');
  });

program.parse();

// ─── Try these ────────────────────────────────────────────────────────────────
// bun examples/11-commander/index.ts serve
// bun examples/11-commander/index.ts serve --port 9000
// bun examples/11-commander/index.ts serve --port 9000 --log-level debug
// PORT=8080 bun examples/11-commander/index.ts serve           # env var
// PORT=8080 bun examples/11-commander/index.ts serve --port 9000  # CLI wins
// bun examples/11-commander/index.ts status
// bun examples/11-commander/index.ts --help
