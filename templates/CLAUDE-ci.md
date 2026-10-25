## CI and pull requests (bloom-marketing-co house rules)

CI minutes cost real money. In October 2026 an agent split one repo's CI into
12 parallel jobs for a faster result and ran up an $80 overage. These rules
apply to every agent (Claude, Codex) and every human.

1. **Never add a CI job, matrix entry or workflow without stating its cost.**
   Put the billed-minutes impact in the PR description ("+1 job ≈ +2 hosted
   minutes per main run, +1 netcup slot per PR run"). CI here is one job by
   design. Prefer a step in the existing job. Never trade minutes for latency.
2. **Open PRs as drafts while you iterate.** Drafts get quick checks only and
   their `Validate` check fails on purpose with "Mark this PR ready for review".
   Mark the PR ready once, when the work is done, to run the full suite. Batch
   your pushes; every push to a ready PR re-runs everything.
3. **Run the pre-push hook; never skip it.** `lefthook` runs the typecheck and
   fast unit tests before each push. Do not use `git push --no-verify` and do
   not set `LEFTHOOK=0`. If the hook is missing, run `npx lefthook install`
   (and `git config --unset core.hooksPath` if an old tool set it).
4. **Do not edit the shared workflow from a project.** The project's
   `.github/workflows/ci.yml` only calls
   `bloom-marketing-co/.github/.github/workflows/ci.yml@v1`. Change inputs
   there; change behaviour in the `.github` repo, for every project at once.
5. **Required checks are `ci / Validate` and `pr / Product outcome`.** Fill
   in the PR template's Product outcome lines (an issue, or "Not applicable" on
   both lines). After editing a PR description, re-run the failed check; no
   push is needed.
6. **Tests must not depend on host speed.** Pull requests run on shared
   self-hosted runners with other jobs on the same box: no tight timeouts, no
   fixed ports (CI gives you `DATABASE_URL`), no wall-clock assertions.
