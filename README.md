# Default GitHub settings for c-o-l-3

GitHub applies the files in this repository to every repository owned by `c-o-l-3` that doesn't have its own version.

| File | What it does |
|---|---|
| [`pull_request_template.md`](pull_request_template.md) | Pre-fills every new pull request with **Why, What changed, See it, Try it, Checks, Not done / risks, Links** |

## Why the template looks like this

Pull requests here are reviewed from the description, the screenshots and the preview link, not from the code. So every PR has to answer, in plain English:

1. **Why** does this change exist?
2. **What** will someone using the app notice?
3. **Show me:** before and after screenshots, and a preview I can click.
4. **How do I try it?** Steps that end in "you should see…".
5. **What was checked**, and what wasn't?
6. **What's left**, or needs a person after merging?

The same rules are in Cole's agent instructions (`~/Dev/CLAUDE.md`, rule 8), so Claude, Codex and the sprint desk write PRs this way even when they fill in the description themselves.

## Notes

- A repository with its own `.github/pull_request_template.md` uses that file instead. Venue-Platform and MyWedGuide keep their own templates because their CI reads the **Product outcome** lines, and those templates include the same sections as this one.
- This repository has to stay public for GitHub to apply it. It contains only templates, nothing private.
