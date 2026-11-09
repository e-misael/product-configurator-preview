import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** scripts/check-release-build.js (D-077) on synthetic build directories. */

const SCRIPT = join(process.cwd(), 'scripts/check-release-build.js');
const HEADERS = readFileSync(join(process.cwd(), 'public/_headers'), 'utf8');
const PHOTOS = [
  'catalog/plates/placa-ceramica-10/bege.png',
  'catalog/plates/quadro-20/bege.jpg',
  'catalog/plates/bandeja-ondulada-m-8/bege.jpg',
  'catalog/plates/bandeja-ondulada-g-11/bege.jpg',
];

let dir: string;

function write(path: string, content = 'x') {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
}

/** A build with everything a release needs. */
function completeBuild() {
  write('index.html', '<!doctype html>');
  write('assets/index-abc123.js', 'console.log(1)');
  write('_headers', HEADERS);
  for (const photo of PHOTOS) write(photo);
}

const check = (...args: string[]) =>
  spawnSync('node', [SCRIPT, dir, ...args], { encoding: 'utf8' });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'release-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('check-release-build (D-077)', () => {
  it('passes a complete build and prints its fingerprint', () => {
    completeBuild();
    const result = check();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Build fingerprint: [0-9a-f]{64}/);
  });

  it('gives the same fingerprint for the same files, and another for any change', () => {
    completeBuild();
    const fingerprint = () => /Build fingerprint: (\w+)/.exec(check().stdout)?.[1];
    const first = fingerprint();
    expect(fingerprint()).toBe(first);
    write('assets/index-abc123.js', 'console.log(2)');
    expect(fingerprint()).not.toBe(first);
  });

  it.each([
    ['index.html', 'index.html is missing'],
    ['_headers', '_headers is missing'],
    ['catalog/plates/quadro-20/bege.jpg', 'catalog/plates/quadro-20/bege.jpg is missing'],
  ])('fails without %s', (missing, message) => {
    completeBuild();
    rmSync(join(dir, missing));
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it('fails when "/*" does not set noindex', () => {
    completeBuild();
    write(
      '_headers',
      '/*\n  X-Content-Type-Options: nosniff\n\n/assets/*\n  X-Robots-Tag: noindex\n',
    );
    expect(check().stderr).toContain('"/*" does not set "X-Robots-Tag: noindex"');
  });

  it('fails on a published source map', () => {
    completeBuild();
    write('assets/index-abc123.js.map', '{}');
    expect(check().stderr).toContain('assets/index-abc123.js.map: source map');
  });

  it('refuses a build that changed after it was stamped', () => {
    completeBuild();
    const stamp = join(dir, '..', `${dir.split('/').at(-1)}.stamp.json`);
    const fingerprint = /Build fingerprint: (\w+)/.exec(check().stdout)?.[1];
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    writeFileSync(stamp, JSON.stringify({ commit, fingerprint, builtAt: 'now' }));
    try {
      expect(check('--verify-stamp', stamp).status).toBe(0);
      write('index.html', '<!doctype html><p>changed');
      const result = check('--verify-stamp', stamp);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('dist/ changed since it was verified');

      writeFileSync(
        stamp,
        JSON.stringify({
          commit: 'other',
          fingerprint: /Build fingerprint: (\w+)/.exec(check().stdout)?.[1],
        }),
      );
      expect(check('--verify-stamp', stamp).stderr).toContain('not HEAD');
    } finally {
      rmSync(stamp, { force: true });
    }
  });

  it('refuses to verify without a stamp', () => {
    completeBuild();
    const result = check('--verify-stamp', join(dir, 'missing.json'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('run npm run release:build first');
  });
});
