// Checks the "Product outcome" section of a pull request description:
//
//   ## Product outcome
//   - Outcome issue: #12 | https://github.com/<org>/<repo>/issues/12 | Not applicable
//   - Relationship: Advances | Implements | Verification only | Not applicable
//
// Run by the reusable pr-outcome workflow. It reads the CURRENT description
// through the API, so re-running the check after editing the PR picks up the
// edit. Bot PRs (Dependabot) are exempt.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RELATIONSHIPS = ['Advances', 'Implements', 'Verification only', 'Not applicable'];
const OWNERS = ['bloom-marketing-co', 'c-o-l-3'];

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function field(section, label) {
  const match = section.match(new RegExp(`^\\s*[-*]\\s*${label}\\s*:[ \\t]*(.*)$`, 'im'));
  return match ? match[1].trim() : '';
}

// Returns { errors, issue } where issue is { repo?, number } for a reference
// that should be checked to exist, or null.
export function parseOutcome(body, repository) {
  const errors = [];
  const text = stripComments(body ?? '');
  const heading = text.match(/^##\s+Product outcome\s*$/im);
  if (!heading) {
    return { errors: ['The description has no "## Product outcome" section. Use the repository PR template.'], issue: null };
  }
  const rest = text.slice(heading.index + heading[0].length);
  const next = rest.search(/^##\s/m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const outcome = field(section, 'Outcome issue');
  const relationship = field(section, 'Relationship');

  let issue = null;
  let notApplicable = false;
  if (/^not applicable\.?$/i.test(outcome)) {
    notApplicable = true;
  } else if (/^#\d+$/.test(outcome)) {
    issue = { repo: repository, number: Number(outcome.slice(1)) };
  } else {
    const url = outcome.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\/?$/);
    if (url && OWNERS.includes(url[1])) {
      issue = { repo: `bloom-marketing-co/${url[2]}`, number: Number(url[3]) };
    } else {
      errors.push(`"Outcome issue" must be #123, a bloom-marketing-co issue URL, or "Not applicable" (found: "${outcome || 'nothing'}").`);
    }
  }

  const rel = RELATIONSHIPS.find((name) => name.toLowerCase() === relationship.replace(/\.$/, '').toLowerCase());
  if (!rel) {
    errors.push(`"Relationship" must be one of: ${RELATIONSHIPS.join(', ')} (found: "${relationship || 'nothing'}").`);
  } else if (notApplicable !== (rel === 'Not applicable')) {
    errors.push('Use "Not applicable" for both lines or for neither.');
  }
  return { errors, issue };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const number = process.env.PR_NUMBER;
  const pr = JSON.parse(gh(['api', `repos/${repository}/pulls/${number}`]));
  if (pr.user?.type === 'Bot') {
    console.log(`Opened by ${pr.user.login}; no product outcome required.`);
    return;
  }
  const { errors, issue } = parseOutcome(pr.body, repository);
  // Only same-repository issues can be confirmed with this job's token.
  if (errors.length === 0 && issue && issue.repo === repository) {
    try {
      const found = JSON.parse(gh(['api', `repos/${repository}/issues/${issue.number}`]));
      if (found.pull_request) errors.push(`#${issue.number} is a pull request, not an issue.`);
    } catch {
      errors.push(`Issue #${issue.number} does not exist in ${repository}.`);
    }
  }
  if (errors.length > 0) {
    for (const error of errors) console.log(`::error::${error}`);
    console.log('Fix the description, then re-run this check (no new push needed).');
    process.exit(1);
  }
  console.log('Product outcome section is complete.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
