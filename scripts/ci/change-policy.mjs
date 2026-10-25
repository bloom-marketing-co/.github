// Decides whether a pull request is documentation-only, so CI can skip the
// install, database and build. Distilled from Venue-Platform. Prints
// `docs_only=true` or `docs_only=false`; anything uncertain is `false`.
//
// The shared CI downloads this file at the exact commit of the reusable
// workflow, so a pull request in a project repo cannot change it. A project
// that needs different rules commits its own scripts/ci/change-policy.mjs;
// CI then runs that file as it exists on the pull request's BASE commit.
import { spawnSync } from 'node:child_process';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Deliberately narrow. Unknown paths always get the complete test suite.
export function isEditorialPath(path) {
  return ['README.md', 'CLAUDE.md', 'AGENTS.md', '.github/pull_request_template.md'].includes(path)
    || /^docs\/.+\.(md|png|jpe?g|webp|gif)$/.test(path);
}

export function documentationOnly(files, isRuntimeInput) {
  return files.length > 0 && files.every((file) => isEditorialPath(file) && !isRuntimeInput(file));
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

export function classifyChanges(base, head, cwd = process.cwd()) {
  if (![base, head].every((sha) => /^[a-f0-9]{40,64}$/.test(sha ?? ''))) return false;
  const diff = git(['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`], cwd);
  if (diff.status !== 0 || diff.error) return false;
  const files = diff.stdout.split('\0').filter(Boolean);
  return documentationOnly(files, (file) => {
    // Inspect both versions. A deletion/rename must not hide a runtime input;
    // moving code into an editorial directory still includes the old code path.
    for (const revision of [base, head]) {
      const entry = git(['ls-tree', revision, '--', file], cwd);
      if (entry.status !== 0 || entry.error) return true;
      if (entry.stdout && !entry.stdout.startsWith('100644 blob ')) return true;
      // Code that reads a file by path, by name or through its folder makes
      // that file a runtime input.
      const references = [file, basename(file)];
      const parts = file.split('/');
      if (parts[0] === 'docs' && parts.length > 2) references.push(dirname(file), `docs/${parts[1]}/`);
      const referenced = git(['grep', '-I', '-F', '-q', ...references.flatMap((ref) => ['-e', ref]), revision, '--', '.', ':(exclude)docs/**', ':(exclude)*.md'], cwd);
      if (referenced.status !== 1 || referenced.error) return true;
    }
    return false;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`docs_only=${classifyChanges(process.argv[2], process.argv[3])}`);
}
