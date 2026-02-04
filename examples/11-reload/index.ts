import { loadConfig } from '../../src/index.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const configPath = join(import.meta.dir, 'config');

const config = await loadConfig({
  schema: {
    refreshInterval: {
      doc: 'How often to refresh data (seconds)',
      format: 'nat',
      default: 60,
      env: 'REFRESH_INTERVAL'
    },
    enableCache: {
      doc: 'Enable caching',
      format: Boolean,
      default: true,
      env: 'ENABLE_CACHE'
    }
  },

  files: ['app'],

  paths: {
    config: configPath
  }
});

config.validate();

console.log('=== Reload Example ===\n');
console.log('Initial configuration:');
console.log('  Refresh Interval:', config.get('refreshInterval'));
console.log('  Cache Enabled:', config.get('enableCache'));

console.log('\n--- Simulating config file change ---');
console.log('Writing new values to config/app.yaml...\n');

writeFileSync(
  join(configPath, 'app.yaml'),
  `refreshInterval: 30
enableCache: false
`
);

console.log('Reloading configuration...\n');
await (config as any).reload();

console.log('After reload:');
console.log('  Refresh Interval:', config.get('refreshInterval'));
console.log('  Cache Enabled:', config.get('enableCache'));

console.log('\n--- Restoring original config ---');
writeFileSync(
  join(configPath, 'app.yaml'),
  `refreshInterval: 120
enableCache: true
`
);

console.log('\n=== Use Cases ===');
console.log('- Long-running servers that need config updates without restart');
console.log('- Development: change config and reload without restarting app');
console.log('- Cloud-native apps with dynamic configuration');
console.log('- Feature flags that can be toggled at runtime');
