// Verifies that a production build is ready to deploy to Cloudflare Pages
// (D-077), then prints its fingerprint for the deployment record.
//
// Checks: the page and its bundles are present; `_headers` keeps the site out
// of search engines; no source maps are published; every production
// photograph is included. Demo isolation is checked separately
// (scripts/check-demo-isolation.js), and both run before every deployment.
//
// The fingerprint is a SHA-256 over every file's path and content, so the
// same build deployed to beta and then to production shows the same value.
// `--stamp <file>` records it with the commit it was built from (clean tree
// only); `--verify-stamp <file>` refuses a build that changed since, or that
// was built from another commit than HEAD.
//
// Usage: node scripts/check-release-build.js <dir> [--stamp <file> | --verify-stamp <file>]

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PHOTOS = [
  'catalog/plates/placa-ceramica-10/bege.png',
  'catalog/plates/quadro-20/bege.jpg',
  'catalog/plates/bandeja-ondulada-m-8/bege.jpg',
  'catalog/plates/bandeja-ondulada-g-11/bege.jpg',
];

const [dir, mode, stampFile] = process.argv.slice(2);
if (!dir || (mode !== undefined && (!['--stamp', '--verify-stamp'].includes(mode) || !stampFile))) {
  console.error(
    'Usage: node scripts/check-release-build.js <dir> [--stamp <file> | --verify-stamp <file>]',
  );
  process.exit(2);
}

function listFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

let files;
try {
  files = listFiles(dir)
    .map((file) => relative(dir, file).split(sep).join('/'))
    .sort();
} catch {
  console.error(`Build directory not found: ${dir}`);
  process.exit(2);
}

const problems = [];
const has = (path) => files.includes(path);

if (!has('index.html')) problems.push('index.html is missing');
if (!files.some((file) => /^assets\/.+\.js$/.test(file))) problems.push('no JavaScript bundle');
for (const photo of PHOTOS) if (!has(photo)) problems.push(`${photo} is missing`);
for (const file of files) if (file.endsWith('.map')) problems.push(`${file}: source map`);

if (!has('_headers')) {
  problems.push('_headers is missing');
} else {
  // The first rule must cover every path and carry noindex.
  const headers = readFileSync(join(dir, '_headers'), 'utf8');
  const rule = headers.split(/\n(?=\S)/).find((block) => block.split('\n')[0]?.trim() === '/*');
  if (!rule || !/^\s+X-Robots-Tag:\s*noindex\b/im.test(rule)) {
    problems.push('_headers: "/*" does not set "X-Robots-Tag: noindex"');
  }
}

if (problems.length > 0) {
  console.error(`Release check failed for ${dir}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const hash = createHash('sha256');
let bytes = 0;
for (const file of files) {
  const content = readFileSync(join(dir, file));
  bytes += statSync(join(dir, file)).size;
  hash.update(`${file}\0${createHash('sha256').update(content).digest('hex')}\n`);
}
const fingerprint = hash.digest('hex');
console.log(`Release check passed: ${files.length} files, ${(bytes / 1024).toFixed(0)} KiB.`);
console.log(`Build fingerprint: ${fingerprint}`);

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();
const commit = git('rev-parse', 'HEAD');

if (mode === '--stamp') {
  if (git('status', '--porcelain') !== '') {
    console.error('Not stamped: the working tree has changes, so the build has no single commit.');
    process.exit(1);
  }
  const stamp = { commit, fingerprint, files: files.length, builtAt: new Date().toISOString() };
  writeFileSync(stampFile, `${JSON.stringify(stamp, null, 2)}\n`);
  console.log(`Build commit: ${commit} (recorded in ${stampFile})`);
}

if (mode === '--verify-stamp') {
  let stamp;
  try {
    stamp = JSON.parse(readFileSync(stampFile, 'utf8'));
  } catch {
    console.error(`No release stamp at ${stampFile}: run npm run release:build first.`);
    process.exit(1);
  }
  if (stamp.fingerprint !== fingerprint) {
    console.error('dist/ changed since it was verified: run npm run release:build again.');
    process.exit(1);
  }
  if (stamp.commit !== commit) {
    console.error(`dist/ was built from ${stamp.commit}, not HEAD ${commit}: rebuild.`);
    process.exit(1);
  }
  console.log(`Build commit: ${commit}, verified ${stamp.builtAt}.`);
}
