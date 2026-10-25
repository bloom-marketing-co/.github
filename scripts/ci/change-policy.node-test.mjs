import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { classifyChanges, documentationOnly } from './change-policy.mjs';

function fixture(changes, references = '') {
  const cwd = mkdtempSync(join(tmpdir(), 'ci-policy-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path, body) => { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), body); };
  git('init', '-q'); git('config', 'user.email', 'ci@example.invalid'); git('config', 'user.name', 'CI test');
  put('lib/app.ts', references || 'export const healthy = true;');
  put('docs/reviews/example.md', 'Old editorial report');
  put('docs/reviews/old.md', 'Other report');
  put('docs/notes.md', 'Top-level note');
  git('add', '.'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  for (const [path, body] of Object.entries(changes)) {
    if (body === null) rmSync(join(cwd, path)); else put(path, body);
  }
  git('add', '.'); git('commit', '-qm', 'change');
  return { cwd, base, head: git('rev-parse', 'HEAD'), git, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}
function checkFixture(changes, expected, references) {
  const repo = fixture(changes, references);
  try { assert.equal(classifyChanges(repo.base, repo.head, repo.cwd), expected); }
  finally { repo.cleanup(); }
}

test('docs, screenshots and agent notes qualify; code, config and empty diffs do not', () => {
  assert.equal(documentationOnly(['docs/reviews/new.md', 'docs/sprints/sample/mobile.png', 'README.md', 'CLAUDE.md'], () => false), true);
  assert.equal(documentationOnly([], () => false), false);
  for (const path of ['app/page.tsx', 'lib/db.ts', 'package.json', 'package-lock.json', 'prisma/schema.prisma', '.github/workflows/ci.yml', 'scripts/check.mjs', 'docs/pricing/rates.pdf', 'docs/reviews/catalog.json', 'docs/reviews/demo.html', 'railway.toml', '.env.example', 'lefthook.yml']) {
    assert.equal(documentationOnly(['docs/reviews/new.md', path], () => false), false, path);
  }
});
test('real docs-only git diff uses quick checks', () => checkFixture({ 'docs/reviews/example.md': 'Updated report' }, true));
test('a top-level docs file does not force full checks just because code says "docs"', () => checkFixture({ 'docs/notes.md': 'Updated' }, true, 'export const label = "docs";'));
test('mixed code and docs run full checks', () => checkFixture({ 'docs/reviews/example.md': 'Update', 'lib/app.ts': 'export const healthy = false;' }, false));
test('moving a source file under docs cannot conceal code deletion', () => checkFixture({ 'lib/app.ts': null, 'docs/reviews/app.md': 'export const healthy = true;' }, false));
test('renamed docs remain quick only when both names are editorial', () => checkFixture({ 'docs/reviews/old.md': null, 'docs/reviews/new.md': 'Other report' }, true));
test('source references by path, basename or folder force full checks', () => {
  for (const reference of ['docs/reviews/example.md', 'example.md', 'docs/reviews', 'docs/reviews/']) {
    checkFixture({ 'docs/reviews/example.md': 'Updated input' }, false, `readFileSync(${JSON.stringify(reference)});`);
  }
});
test('deleted runtime input still forces full checks', () => checkFixture({ 'docs/reviews/example.md': null }, false, 'load("docs/reviews/example.md");'));
test('missing history and malformed revisions fail closed', () => {
  assert.equal(classifyChanges('', ''), false);
  assert.equal(classifyChanges('x', 'x'), false);
  assert.equal(classifyChanges('a'.repeat(40), 'b'.repeat(40)), false);
});
test('symlink masquerading as a doc forces full checks', () => {
  const repo = fixture({ 'docs/reviews/example.md': 'target' });
  try {
    execFileSync('git', ['update-index', '--cacheinfo', `120000,${repo.git('hash-object', 'docs/reviews/example.md')},docs/reviews/example.md`], { cwd: repo.cwd });
    repo.git('commit', '-qm', 'symlink');
    assert.equal(classifyChanges(repo.base, repo.git('rev-parse', 'HEAD'), repo.cwd), false);
  } finally { repo.cleanup(); }
});
