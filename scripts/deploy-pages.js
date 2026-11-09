// Uploads the verified production build in dist/ to Cloudflare Pages by
// Direct Upload (D-077). Run only as described in docs/08-deployment.md:
// after `npm run release:verify`, from a clean working tree, and logged in with
// `wrangler login` in the browser. Credentials stay with Wrangler; this
// script never reads or prints them.
//
//   node scripts/deploy-pages.js beta                        → beta.<project>.pages.dev
//   node scripts/deploy-pages.js production --confirm-production → <project>.pages.dev
//
// Production deploys the same dist/ verified on beta; compare the build
// fingerprint printed by both runs.

import { spawnSync } from 'node:child_process';

const PROJECT = 'crie-com-a-taavi';
// Pinned: the same Wrangler for every deployment and every command in the runbook.
const WRANGLER = 'wrangler@4.153.0';
const BRANCHES = { beta: 'beta', production: 'main' };

const [target, flag] = process.argv.slice(2);
const branch = BRANCHES[target];
if (!branch) {
  console.error('Usage: node scripts/deploy-pages.js beta|production [--confirm-production]');
  process.exit(2);
}
if (target === 'production' && flag !== '--confirm-production') {
  console.error('Production needs --confirm-production, after the beta checks are approved.');
  process.exit(2);
}

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();

if (git('status', '--porcelain') !== '') {
  console.error('The working tree has changes: commit or stash them, rebuild, and verify again.');
  process.exit(1);
}
const commit = git('rev-parse', 'HEAD');
const message = git('log', '-1', '--format=%s');

run('node', ['scripts/check-demo-isolation.js', 'dist']);
// The dist/ verified by release:verify, built from this commit, unchanged since.
run('node', ['scripts/check-release-build.js', 'dist', '--verify-stamp', '.release-build.json']);

console.log(`Deploying commit ${commit} to ${PROJECT}, branch "${branch}" (${target}).`);
run('npx', [
  '--yes',
  WRANGLER,
  'pages',
  'deploy',
  'dist',
  `--project-name=${PROJECT}`,
  `--branch=${branch}`,
  `--commit-hash=${commit}`,
  `--commit-message=${message}`,
  '--commit-dirty=false',
]);
