# bloom-marketing-co defaults and the golden path

This repository does two jobs for every repository in `bloom-marketing-co`:

1. **Org defaults.** GitHub applies `pull_request_template.md` to every
   repository that has no template of its own. It must stay public for that,
   and it contains only templates and CI, nothing private.
2. **The golden path.** The shared CI that every new project calls, and the
   files the project template copies.

## Start a new project

```bash
~/Dev/tooling/bin/new-project guest-portal --title "Guest Portal"
```

One command, about five minutes:

| Step | Result |
|---|---|
| Repo | `bloom-marketing-co/guest-portal`, private, from [`template-nextjs-prisma`](https://github.com/bloom-marketing-co/template-nextjs-prisma) (Next.js 16, Prisma 7, PostgreSQL 18, Vitest, lefthook) |
| Settings | Squash merge only, auto-merge on, branches deleted after merge, Dependabot security updates, read-only workflow token |
| Protection | `main` requires `ci / Validate` and `pr / Product outcome`, from GitHub Actions only, admins included |
| First CI | A bootstrap PR (name and title filled in) runs full CI on the netcup runners and auto-merges when green |
| Railway | Project `guest-portal` created from the repo's `.railway/railway.ts` (Infrastructure as Code): PostgreSQL and a `web` service deploying `main`; migrations run before each deploy; `/api/health` gates traffic. `railway.toml`/`railway.json` are deprecated and stop working on 2026-12-01 |
| By hand | The script prints the rest: usage limit, app secrets, custom domain, first outcome issue |

Retire one with `~/Dev/tooling/bin/archive-project <slug>` and the
[archive checklist](https://github.com/bloom-marketing-co/tooling/blob/main/ARCHIVE.md).

## Shared CI

`.github/workflows/ci.yml` is a reusable workflow. A project calls it with a
few lines ([templates/ci-caller.yml](templates/ci-caller.yml)):

```yaml
jobs:
  ci:
    uses: bloom-marketing-co/.github/.github/workflows/ci.yml@v1
    with:
      postgres: true
      setup-command: npm run db:migrate && npm run db:check-drift
```

| Input | Default | |
|---|---|---|
| `node-version` | `22` | |
| `postgres` | `false` | Starts PostgreSQL 18 on a dynamic port and exports `DATABASE_URL` |
| `cache` | `npm` | `actions/setup-node` cache; empty for none |
| `install-command` | `npm ci --no-audit --no-fund` | |
| `setup-command` | empty | After install, with the database, e.g. migrations |
| `typecheck-command` | `npm run typecheck` | Empty to skip |
| `test-command` | `npm test` | Empty to skip |
| `build-command` | `npm run build` | Empty to skip |
| `quick-command` | empty | Extra checks for drafts and docs-only PRs, without installing |
| `next-cache` | `true` | Restores and saves `.next/cache` |
| `timeout-minutes` | `20` | |

What it does, and why:

- **One job per run.** Extra jobs each pay checkout, install and per-minute
  rounding, and hold one of four netcup runners shared by the whole org. In
  October 2026 a 12-job split cost $80 in overage. Changing this needs a
  stated minute cost.
- **Pull requests run on the netcup runners** (free);
  the weekly Sunday main backstop and manual runs use GitHub-hosted runners, so
  a dead netcup box never blocks a merge:
  `runs-on: ${{ github.event_name == 'pull_request' && 'self-hosted' || 'ubuntu-latest' }}`.
- **Drafts are cheap.** A draft gets `git diff --check` and `quick-command`
  only, then `Validate` fails on purpose ("Mark this PR ready for review"), so
  untested code can never merge. Marking it ready runs everything.
- **Docs-only PRs are cheap.** [`scripts/ci/change-policy.mjs`](scripts/ci/change-policy.mjs)
  passes PRs that only touch `README.md`, `CLAUDE.md`, `AGENTS.md`, the PR
  template or `docs/**/*.md` and images, unless code refers to those files.
  It is downloaded at the exact commit of the workflow, so a PR cannot weaken
  it. A project can commit its own `scripts/ci/change-policy.mjs`; CI then runs
  the copy from the PR's base commit.
- **A new push cancels the older run** (`concurrency`, `cancel-in-progress`).
- **Every check reports** even if an earlier one failed; only a failed install
  skips the rest.

`.github/workflows/pr-outcome.yml` checks the **Product outcome** lines of the
PR description ([templates/pr-caller.yml](templates/pr-caller.yml)). It is one
tiny job with no checkout. It reads the current description, so after editing
a PR you re-run the check instead of pushing. Dependabot PRs are exempt.

## Files projects copy

| File | Goes to |
|---|---|
| [`pull_request_template.md`](pull_request_template.md) | `.github/pull_request_template.md` (also the org default) |
| [`templates/ci-caller.yml`](templates/ci-caller.yml), [`templates/pr-caller.yml`](templates/pr-caller.yml) | `.github/workflows/ci.yml`, `.github/workflows/pr.yml` |
| [`templates/dependabot.yml`](templates/dependabot.yml) | `.github/dependabot.yml` (monthly, grouped, majors ignored; security updates always) |
| [`templates/CLAUDE-ci.md`](templates/CLAUDE-ci.md) | Appended to the project's `CLAUDE.md` |
| `templates/claude-caller.yml` (reserved) | `.github/workflows/claude.yml`: the `@claude` / `claude`-label trigger for the Claude Code GitHub Action, on the netcup runners. Added by the Claude Code action rollout, not part of the first version of the path. |

To add the shared CI to an existing repo, copy the caller, adjust its inputs,
and set the branch protection required check to `ci / Validate`.

## Changing the shared CI

Projects pin `@v1`. Change the workflow in a PR here (the `Self-test` workflow
runs actionlint and the script tests on GitHub-hosted runners, free for public
repositories), merge, try it from one project by pointing its caller at
`@main` in a ready PR, then move the tag:

```bash
git tag -f v1 && git push -f origin v1
```

A breaking change gets `v2`, and projects move over one by one.
