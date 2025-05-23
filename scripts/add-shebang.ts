#!/usr/bin/env bun

/**
 * Add shebang to CLI build outputs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const shebang = '#!/usr/bin/env node\n';
const cliFiles = ['dist/cli.cjs', 'dist/cli.mjs'];

for (const file of cliFiles) {
  const filePath = resolve(file);
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (!content.startsWith('#!')) {
      writeFileSync(filePath, shebang + content);
      console.log(`✓ Added shebang to ${file}`);
    } else {
      console.log(`⚠️  ${file} already has shebang`);
    }
  } catch (error) {
    console.error(`✗ Failed to process ${file}:`, error);
  }
}
