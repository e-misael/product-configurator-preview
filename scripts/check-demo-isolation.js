// Verifies that a build output contains no demonstration data (D-028).
//
// Scans every file under the given directory (all JS chunks, including
// dynamically imported ones, CSS, HTML, and assets), not only the entry
// bundle. With --expect-present it asserts the opposite, proving the
// markers are detectable in a demo build.
//
// Usage: node scripts/check-demo-isolation.js <dir> [--expect-present]

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const MARKERS = [
  'demo-placa',
  'demo-quadro',
  'demo-cor',
  'demo-catalog',
  'Modo demonstração',
  // Minifiers may escape non-ASCII characters.
  'Modo demonstra\\u00e7\\u00e3o',
  '(demonstração)',
  '(demonstra\\u00e7\\u00e3o)',
  // Embedded in every synthetic demo image (scripts/generate-demo-assets.js).
  'Synthetic demonstration image',
];

const [dir, flag] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: node scripts/check-demo-isolation.js <dir> [--expect-present]');
  process.exit(2);
}
const expectPresent = flag === '--expect-present';

function listFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

let files;
try {
  files = listFiles(dir);
} catch {
  console.error(`Build directory not found: ${dir}`);
  process.exit(2);
}

const hits = [];
for (const file of files) {
  // Demo files are also recognizable by name (e.g. catalog/plates/demo-placa-*/).
  for (const marker of MARKERS) {
    if (relative(dir, file).includes(marker))
      hits.push(`${relative(dir, file)}: ${marker} (file name)`);
  }
  // latin1 keeps every byte, so binary files can be scanned too.
  const content = readFileSync(file).toString('latin1');
  const utf8 = readFileSync(file, 'utf8');
  for (const marker of MARKERS) {
    if (content.includes(marker) || utf8.includes(marker)) {
      hits.push(`${relative(dir, file)}: ${marker}`);
    }
  }
}

console.log(`Scanned ${files.length} files in ${dir}:`);
for (const file of files) console.log(`  ${relative(dir, file)}`);

if (expectPresent) {
  if (hits.length === 0) {
    console.error('FAIL: expected demo markers, found none.');
    process.exit(1);
  }
  console.log(`OK: demo markers found (${hits.length}).`);
} else {
  if (hits.length > 0) {
    console.error('FAIL: demonstration data found in build output:');
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
  }
  console.log('OK: no demonstration data found.');
}
